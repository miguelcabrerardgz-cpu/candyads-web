import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChallenge, verifySolution, randomInt, solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { createHandler } from '../src/core.mjs';

const ORIGIN = 'https://candyads.es';
const PERSONALES = ['Marta Prueba', '600123456', 'marta.prueba@example.com', 'Quiero vender mi vivienda', 'Mensaje privado 123'];

function entorno({ limite = 100, config, destino = 'jose@lacasa.example', sesFalla = false } = {}) {
  const estado = { retos: new Set(), contador: 0, correos: [], logs: [], reloj: Date.now() };
  const cfgSitio = config ?? { nombre_mostrado: 'La Casa Agency', activo: true, campos: ['nombre', 'telefono', 'email', 'interes_venta_alquiler', 'mensaje'] };

  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://candyads.es/data/anunciantes/')) {
      const slug = u.split('/').pop().replace('.json', '');
      if (slug !== 'lacasa-piloto') return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => cfgSitio };
    }
    if (u.startsWith('https://x.supabase.co/rest/v1/rpc/')) {
      const fn = u.split('/').pop();
      const a = JSON.parse(init.body);
      let out;
      if (fn === 'destino_de') out = a.p_slug === 'lacasa-piloto' ? destino : null;
      else if (fn === 'consumir_reto') { out = !estado.retos.has(a.p_huella); estado.retos.add(a.p_huella); }
      else if (fn === 'reservar_lead') { out = estado.contador < limite; if (out) estado.contador += 1; }
      else if (fn === 'liberar_lead') { estado.contador = Math.max(0, estado.contador - 1); out = null; }
      return { ok: true, status: 200, json: async () => out };
    }
    throw new Error('fetch inesperado: ' + u);
  };

  const log = {
    info: (m) => estado.logs.push(String(m)),
    error: (m) => estado.logs.push(String(m))
  };

  const handle = createHandler({
    env: {
      ALLOWED_ORIGIN: ORIGIN, SITE_URL: ORIGIN, SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test', ALTCHA_HMAC_SECRET: 'secreto-a', ALTCHA_HMAC_KEY_SECRET: 'secreto-b',
      SES_FROM: 'Candy Ads <leads@candyads.es>', ALTCHA_COST: '50'
    },
    fetchImpl,
    altcha: { createChallenge, verifySolution, randomInt, deriveKey },
    sendEmail: async (m) => { if (sesFalla) throw Object.assign(new Error('boom'), { name: 'MessageRejected' }); estado.correos.push(m); },
    now: () => estado.reloj,
    log
  });
  return { handle, estado };
}

const cab = { origin: ORIGIN };
const get = (handle, path = '/challenge', headers = cab) => handle({ method: 'GET', path, headers, body: '', ip: '1.1.1.1' });

async function payloadAltcha(handle) {
  const r = await get(handle);
  const reto = JSON.parse(r.body);
  const solucion = await solveChallenge({ challenge: reto, deriveKey });
  assert.ok(solucion, 'el reto debería resolverse');
  return Buffer.from(JSON.stringify({ challenge: { parameters: reto.parameters, signature: reto.signature }, solution: solucion })).toString('base64');
}

const datosOk = () => ({ nombre: 'Marta Prueba', telefono: '600123456', email: 'marta.prueba@example.com', interes_venta_alquiler: 'Quiero vender mi vivienda', mensaje: 'Mensaje privado 123' });

async function enviar(handle, over = {}, ip = '2.2.2.2') {
  const altcha = over.altcha ?? await payloadAltcha(handle);
  const cuerpo = { slug: 'lacasa-piloto', datos: datosOk(), consentimiento: true, t: 5000, altcha, ...over };
  return handle({ method: 'POST', path: '/lead', headers: cab, body: JSON.stringify(cuerpo), ip });
}

const codigo = (r) => JSON.parse(r.body).code;

test('reto ALTCHA: firmado y con caducidad', async () => {
  const { handle } = entorno();
  const r = await get(handle);
  assert.equal(r.statusCode, 200);
  const reto = JSON.parse(r.body);
  assert.ok(reto.signature);
  assert.ok(reto.parameters.expiresAt > Math.floor(Date.now() / 1000));
});

test('origen no permitido: 403 en reto, lead y OPTIONS', async () => {
  const { handle } = entorno();
  const mal = { origin: 'https://malo.example' };
  assert.equal((await get(handle, '/challenge', mal)).statusCode, 403);
  assert.equal((await handle({ method: 'POST', path: '/lead', headers: mal, body: '{}', ip: '3.3.3.3' })).statusCode, 403);
  assert.equal((await handle({ method: 'OPTIONS', path: '/lead', headers: mal, body: '', ip: '3.3.3.3' })).statusCode, 403);
  const ok = await handle({ method: 'OPTIONS', path: '/lead', headers: cab, body: '', ip: '3.3.3.3' });
  assert.equal(ok.statusCode, 204);
  assert.equal(ok.headers['access-control-allow-origin'], ORIGIN);
});

test('camino feliz: un email al anunciante, contador +1, sin datos personales en logs', async () => {
  const { handle, estado } = entorno();
  const r = await enviar(handle);
  assert.equal(r.statusCode, 200);
  assert.equal(estado.contador, 1);
  assert.equal(estado.correos.length, 1);
  const c = estado.correos[0];
  assert.equal(c.to, 'jose@lacasa.example');
  assert.equal(c.replyTo, 'marta.prueba@example.com');
  for (const p of PERSONALES) { assert.ok(c.text.includes(p), 'texto incluye ' + p); }
  for (const p of PERSONALES) { assert.ok(!c.subject.includes(p), 'el asunto no debe llevar datos personales'); }
  const logs = estado.logs.join('\n');
  for (const p of PERSONALES) assert.ok(!logs.includes(p), 'log con dato personal: ' + p);
  assert.ok(!logs.includes('jose@lacasa.example'));
});

test('reutilizar la misma solución ALTCHA es rechazado', async () => {
  const { handle, estado } = entorno();
  const altcha = await payloadAltcha(handle);
  assert.equal((await enviar(handle, { altcha })).statusCode, 200);
  const r2 = await enviar(handle, { altcha }, '2.2.2.3');
  assert.equal(r2.statusCode, 400);
  assert.equal(codigo(r2), 'altcha_reutilizado');
  assert.equal(estado.correos.length, 1);
  assert.equal(estado.contador, 1);
});

test('solución ALTCHA manipulada o ausente: 400', async () => {
  const { handle, estado } = entorno();
  const decod = async () => JSON.parse(Buffer.from(await payloadAltcha(handle), 'base64').toString());
  const cod = (o) => Buffer.from(JSON.stringify(o)).toString('base64');

  const claveFalsa = await decod();
  claveFalsa.solution.derivedKey = claveFalsa.solution.derivedKey.replace(/.$/, (c) => (c === '0' ? '1' : '0'));
  assert.equal(codigo(await enviar(handle, { altcha: cod(claveFalsa) }, '4.4.4.1')), 'altcha');

  const parametrosFalsos = await decod();
  parametrosFalsos.challenge.parameters.cost = 1;
  assert.equal(codigo(await enviar(handle, { altcha: cod(parametrosFalsos) }, '4.4.4.2')), 'altcha');

  const sinFirma = await decod();
  delete sinFirma.challenge.signature;
  assert.equal(codigo(await enviar(handle, { altcha: cod(sinFirma) }, '4.4.4.3')), 'altcha');

  assert.equal(codigo(await enviar(handle, { altcha: 'no-es-base64-json' }, '4.4.4.4')), 'altcha');
  assert.equal(codigo(await enviar(handle, { altcha: undefined }, '4.4.4.5')), 'altcha');
  assert.equal(estado.correos.length, 0);
  assert.equal(estado.contador, 0);
});

test('reto caducado: 400', async () => {
  const { handle, estado } = entorno();
  estado.reloj = Date.now() - 60 * 60 * 1000;
  const altcha = await payloadAltcha(handle);
  estado.reloj = Date.now();
  assert.equal(codigo(await enviar(handle, { altcha })), 'altcha');
  assert.equal(estado.correos.length, 0);
});

test('validaciones básicas', async () => {
  const { handle, estado } = entorno();
  assert.equal(codigo(await enviar(handle, { consentimiento: false }, '5.5.5.1')), 'consentimiento');
  assert.equal(codigo(await enviar(handle, { t: 500 }, '5.5.5.2')), 'demasiado_rapido');
  assert.equal(codigo(await enviar(handle, { slug: '../../etc/passwd' }, '5.5.5.3')), 'slug');
  assert.equal(codigo(await enviar(handle, { slug: 'no-existe' }, '5.5.5.4')), 'no_disponible');
  assert.equal(codigo(await enviar(handle, { datos: { ...datosOk(), telefono: '12' } }, '5.5.5.5')), 'datos_formato');
  assert.equal(codigo(await enviar(handle, { datos: { ...datosOk(), interes_venta_alquiler: 'otra cosa' } }, '5.5.5.6')), 'datos_opción_no_válida');
  assert.equal(codigo(await enviar(handle, { datos: { ...datosOk(), extra: 'x' } }, '5.5.5.7')), 'datos_campo_no_permitido');
  assert.equal(codigo(await enviar(handle, { datos: { ...datosOk(), nombre: '' } }, '5.5.5.8')), 'datos_obligatorio');
  assert.equal(codigo(await enviar(handle, { datos: { ...datosOk(), mensaje: 'x'.repeat(501) } }, '5.5.5.9')), 'datos_demasiado_largo');
  assert.equal(estado.correos.length, 0);
  assert.equal(estado.contador, 0);
});

test('anunciante inactivo o sin destino: 404', async () => {
  const inactivo = entorno({ config: { nombre_mostrado: 'X', activo: false, campos: ['nombre'] } });
  assert.equal(codigo(await enviar(inactivo.handle, {}, '6.6.6.1')), 'no_disponible');
  const sinDestino = entorno({ destino: null });
  assert.equal(codigo(await enviar(sinDestino.handle, {}, '6.6.6.2')), 'sin_destino');
  assert.equal(sinDestino.estado.correos.length, 0);
});

test('límite diario: el lead que lo supera recibe 429 y no se envía', async () => {
  const { handle, estado } = entorno({ limite: 1 });
  assert.equal((await enviar(handle, {}, '7.7.7.1')).statusCode, 200);
  const r = await enviar(handle, {}, '7.7.7.2');
  assert.equal(r.statusCode, 429);
  assert.equal(codigo(r), 'limite_diario');
  assert.equal(estado.correos.length, 1);
  assert.equal(estado.contador, 1);
});

test('si SES falla se libera la reserva: el contador no cuenta leads no entregados', async () => {
  const { handle, estado } = entorno({ sesFalla: true });
  const r = await enviar(handle);
  assert.equal(r.statusCode, 502);
  assert.equal(estado.contador, 0);
  const logs = estado.logs.join('\n');
  for (const p of PERSONALES) assert.ok(!logs.includes(p));
});

test('límite por IP en memoria: el sexto intento en 10 minutos es 429; pasada la ventana se libera', async () => {
  const { handle, estado } = entorno();
  for (let i = 0; i < 5; i++) assert.notEqual((await enviar(handle, { consentimiento: false }, '8.8.8.8')).statusCode, 429);
  assert.equal((await enviar(handle, { consentimiento: false }, '8.8.8.8')).statusCode, 429);
  estado.reloj += 11 * 60 * 1000;
  assert.notEqual((await enviar(handle, { consentimiento: false }, '8.8.8.8')).statusCode, 429);
});

test('cuerpo demasiado grande: 413', async () => {
  const { handle } = entorno();
  const r = await handle({ method: 'POST', path: '/lead', headers: cab, body: 'x'.repeat(9000), ip: '9.9.9.9' });
  assert.equal(r.statusCode, 413);
});

test('el HTML del email escapa lo que escribe la persona', async () => {
  const { handle, estado } = entorno();
  const r = await enviar(handle, { datos: { ...datosOk(), nombre: '<script>alert(1)</script>', mensaje: '"><img src=x onerror=alert(1)>' } }, '10.1.1.1');
  assert.equal(r.statusCode, 200);
  const html = estado.correos[0].html;
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('caracteres de control se eliminan y el email no admite saltos de línea', async () => {
  const { handle, estado } = entorno();
  const r = await enviar(handle, { datos: { ...datosOk(), nombre: 'Ana  López', email: 'a@b.es\nBcc: x@y.es' } }, '11.1.1.1');
  assert.equal(codigo(r), 'datos_formato');
  const ok = await enviar(handle, { datos: { ...datosOk(), nombre: 'Ana  López' } }, '11.1.1.2');
  assert.equal(ok.statusCode, 200);
  assert.ok(estado.correos[0].text.includes('Nombre: Ana López'));
});
