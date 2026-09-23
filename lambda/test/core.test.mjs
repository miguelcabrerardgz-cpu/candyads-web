import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChallenge, verifySolution, randomInt, solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { createHandler } from '../src/core.mjs';

const ORIGIN = 'https://candyads.es';
const PERSONALES = ['Marta Prueba', '600123456', 'marta.prueba@example.com', 'Quiero vender mi vivienda', 'Mensaje privado 123'];

function entorno({ limite = 100, config, destino = 'jose@lacasa.example', sesFalla = false } = {}) {
  const estado = { retos: new Set(), contador: 0, registro: new Map(), correos: [], logs: [], reloj: Date.now() };
  const cfgSitio = config ?? {
    estado: 'activa', nombre_mostrado: 'La Casa Agency',
    campos: ['nombre', 'telefono', 'email', 'interes_venta_alquiler', 'mensaje'],
    tema_color: null, tema_color_secundario: null, tema_logo: null,
    razon_social: null, cif: null, email_privacidad: null
  };

  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.startsWith('https://x.supabase.co/rest/v1/rpc/')) {
      const fn = u.split('/').pop();
      const a = JSON.parse(init.body);
      let out;
      if (fn === 'config_publico_de') out = a.p_slug === 'lacasa-piloto' ? cfgSitio : null;
      else if (fn === 'destino_de') out = a.p_slug === 'lacasa-piloto' ? destino : null;
      else if (fn === 'consumir_reto') { out = !estado.retos.has(a.p_huella); estado.retos.add(a.p_huella); }
      else if (fn === 'reservar_lead') { out = estado.contador < limite; if (out) estado.contador += 1; }
      else if (fn === 'reservar_lead_ref') { out = estado.contador < limite; if (out) { estado.contador += 1; estado.registro.set(a.p_ref, { slug: a.p_slug, estado: 'pendiente', recibidoEn: estado.reloj }); } }
      else if (fn === 'confirmar_lead_ref') { Object.assign(estado.registro.get(a.p_ref), { estado: 'enviado', mensaje: a.p_mensaje }); out = null; }
      else if (fn === 'fallar_lead_ref') { estado.registro.get(a.p_ref).estado = 'error'; estado.contador = Math.max(0, estado.contador - 1); out = null; }
      else if (fn === 'marcar_conversion') {
        const reg = estado.registro.get(a.p_ref);
        out = !!reg && (a.p_conversion === 'venta' || a.p_conversion === 'sin_venta');
        if (out) Object.assign(reg, { conversion: a.p_conversion });
      }
      else if (fn === 'leads_pendientes_recordatorio') {
        const DIA = 24 * 60 * 60 * 1000;
        out = [];
        for (const [ref, reg] of estado.registro) {
          if (reg.estado !== 'enviado' || (reg.conversion && reg.conversion !== 'pendiente')) continue;
          const edad = estado.reloj - reg.recibidoEn;
          let tipo = null;
          if (edad >= 30 * DIA && !reg.recordatorio30) tipo = '30';
          else if (edad >= 15 * DIA && !reg.recordatorio15) tipo = '15';
          if (tipo) out.push({ ref, anunciante_slug: reg.slug, destino, referencia: ref.slice(0, 8).toUpperCase(), recibido_at: new Date(reg.recibidoEn).toISOString(), tipo });
        }
      }
      else if (fn === 'marcar_recordatorio_enviado') {
        const reg = estado.registro.get(a.p_ref);
        if (reg) {
          if (a.p_tipo === '15') reg.recordatorio15 = true;
          else if (a.p_tipo === '30') { reg.recordatorio30 = true; reg.recordatorio15 = true; }
        }
        out = null;
      }
      return { ok: true, status: 200, json: async () => out };
    }
    throw new Error('fetch inesperado: ' + u);
  };

  const log = {
    info: (m) => estado.logs.push(String(m)),
    error: (m) => estado.logs.push(String(m))
  };

  const { handle, procesarRecordatorios } = createHandler({
    env: {
      ALLOWED_ORIGIN: ORIGIN, SITE_URL: ORIGIN, SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test', ALTCHA_HMAC_SECRET: 'secreto-a', ALTCHA_HMAC_KEY_SECRET: 'secreto-b',
      SES_FROM: 'Candy Ads <leads@candyads.es>', ALTCHA_COST: '50', CONTACT_TO: 'equipo@candyads.es'
    },
    fetchImpl,
    altcha: { createChallenge, verifySolution, randomInt, deriveKey },
    sendEmail: async (m) => { if (sesFalla) throw Object.assign(new Error('boom'), { name: 'MessageRejected' }); estado.correos.push(m); return { messageId: 'ses-msg-1' }; },
    now: () => estado.reloj,
    log
  });
  return { handle, procesarRecordatorios, estado };
}

const cab = { origin: ORIGIN };
const get = (handle, path = '/challenge', headers = cab) => handle({ method: 'GET', path, headers, body: '', ip: '1.1.1.1' });
const config = (handle, slug, headers = cab) => handle({ method: 'GET', path: '/config', headers, body: '', ip: '1.1.1.1', query: { slug } });

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
const confirmar = (handle, body, ip = '20.20.20.1', headers = cab) =>
  handle({ method: 'POST', path: '/confirmar', headers, body: JSON.stringify(body), ip });

const datosContactoOk = () => ({ nombre: 'Marta Prueba', empresa: 'Bar Ejemplo', tipo: 'bar', telefono: '600123456', email: 'marta.prueba@example.com', mensaje: 'Mensaje privado 123' });
async function contactar(handle, over = {}, ip = '30.30.30.1') {
  const cuerpo = { datos: datosContactoOk(), privacidad: true, t: 5000, ...over };
  return handle({ method: 'POST', path: '/contacto', headers: cab, body: JSON.stringify(cuerpo), ip });
}

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

test('trazabilidad: el lead queda registrado como enviado con id de SES y su referencia va en el correo, sin datos personales', async () => {
  const { handle, estado } = entorno();
  await enviar(handle);
  assert.equal(estado.registro.size, 1);
  const [[ref, reg]] = [...estado.registro];
  assert.equal(reg.estado, 'enviado');
  assert.equal(reg.mensaje, 'ses-msg-1');
  assert.equal(reg.slug, 'lacasa-piloto');
  assert.deepEqual(Object.keys(reg).sort(), ['estado', 'mensaje', 'recibidoEn', 'slug']);
  assert.ok(estado.correos[0].text.includes('Referencia: ' + ref.slice(0, 8).toUpperCase()));
  assert.ok(estado.correos[0].html.includes('https://candyads.es/assets/candyads-icono.png'), 'el correo lleva el logo oficial');
  const enlaceVenta = `https://candyads.es/confirmar.html?ref=${ref}&r=venta`;
  const enlaceSinVenta = `https://candyads.es/confirmar.html?ref=${ref}&r=sin_venta`;
  assert.ok(estado.correos[0].text.includes(enlaceVenta), 'el texto lleva el enlace de confirmar venta');
  assert.ok(estado.correos[0].text.includes(enlaceSinVenta), 'el texto lleva el enlace de confirmar sin venta');
  // En el HTML el "&" de la URL va escapado a "&amp;", como corresponde dentro de un atributo href.
  assert.ok(estado.correos[0].html.includes(enlaceVenta.replace('&', '&amp;')), 'el html lleva el enlace de confirmar venta');
  assert.ok(estado.correos[0].html.includes(enlaceSinVenta.replace('&', '&amp;')), 'el html lleva el enlace de confirmar sin venta');
});

test('confirmación de venta: un clic desde el correo marca el registro por su referencia', async () => {
  const { handle, estado } = entorno();
  await enviar(handle);
  const [ref] = [...estado.registro.keys()];

  const r = await confirmar(handle, { ref, conversion: 'venta' });
  assert.equal(r.statusCode, 200);
  assert.equal(estado.registro.get(ref).conversion, 'venta');

  // Se puede cambiar de opinión: no rompe nada llamarlo otra vez con otro valor.
  const r2 = await confirmar(handle, { ref, conversion: 'sin_venta' });
  assert.equal(r2.statusCode, 200);
  assert.equal(estado.registro.get(ref).conversion, 'sin_venta');
});

test('confirmación de venta: referencia desconocida da 404, valores inválidos dan 400', async () => {
  const { handle } = entorno();
  const desconocida = await confirmar(handle, { ref: '11111111-1111-4111-8111-111111111111', conversion: 'venta' });
  assert.equal(desconocida.statusCode, 404);
  assert.equal(codigo(desconocida), 'no_encontrado');

  assert.equal(codigo(await confirmar(handle, { ref: 'no-es-un-uuid', conversion: 'venta' })), 'ref');
  assert.equal(codigo(await confirmar(handle, { ref: '11111111-1111-4111-8111-111111111111', conversion: 'quizas' })), 'conversion');
  assert.equal(codigo(await confirmar(handle, {})), 'ref');
});

test('confirmación de venta: origen no permitido da 403', async () => {
  const { handle } = entorno();
  const r = await confirmar(handle, { ref: '11111111-1111-4111-8111-111111111111', conversion: 'venta' }, '20.20.20.2', { origin: 'https://malo.example' });
  assert.equal(r.statusCode, 403);
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
  const inactivo = entorno({ config: { estado: 'pausada', nombre_mostrado: 'X', campos: ['nombre'] } });
  assert.equal(codigo(await enviar(inactivo.handle, {}, '6.6.6.1')), 'no_disponible');
  const sinDestino = entorno({ destino: null });
  assert.equal(codigo(await enviar(sinDestino.handle, {}, '6.6.6.2')), 'sin_destino');
  assert.equal(sinDestino.estado.correos.length, 0);
});

test('config pública: campaña activa devuelve ficha, sin activa solo el estado, inexistente da 404', async () => {
  const { handle } = entorno({
    config: {
      estado: 'activa', nombre_mostrado: 'La Casa Agency', campos: ['nombre', 'telefono'],
      tema_color: '#1C4C98', tema_color_secundario: '#909CCC', tema_logo: '/assets/anunciantes/lacasa.png',
      razon_social: 'La Casa Agency SL', cif: 'B12345678', email_privacidad: 'privacidad@lacasa.example'
    }
  });
  const r = await config(handle, 'lacasa-piloto');
  assert.equal(r.statusCode, 200);
  const c = JSON.parse(r.body);
  assert.deepEqual(c, {
    estado: 'activa', nombre_mostrado: 'La Casa Agency', campos: ['nombre', 'telefono'],
    tema: { color: '#1C4C98', color_secundario: '#909CCC', logo: '/assets/anunciantes/lacasa.png' },
    razon_social: 'La Casa Agency SL', nif_cif: 'B12345678', email_privacidad: 'privacidad@lacasa.example'
  });

  const pausada = entorno({ config: { estado: 'pausada', nombre_mostrado: 'La Casa Agency', campos: [] } });
  const r2 = await config(pausada.handle, 'lacasa-piloto');
  assert.equal(r2.statusCode, 200);
  assert.deepEqual(JSON.parse(r2.body), { estado: 'pausada' }, 'no expone datos de la ficha si no está activa');

  const r3 = await config(handle, 'no-existe');
  assert.equal(r3.statusCode, 404);
  assert.equal(codigo(r3), 'no_encontrado');
});

test('config pública: slug inválido da 400, origen no permitido da 403', async () => {
  const { handle } = entorno();
  assert.equal(codigo(await config(handle, '../../etc/passwd')), 'slug');
  const r = await config(handle, 'lacasa-piloto', { origin: 'https://malo.example' });
  assert.equal(r.statusCode, 403);
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
  assert.equal([...estado.registro.values()][0].estado, 'error');
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

test('sin configuración completa el backend falla cerrado (no emite retos ni acepta leads)', async () => {
  const estado = { logs: [] };
  const { handle, procesarRecordatorios } = createHandler({
    env: { ALLOWED_ORIGIN: ORIGIN, SITE_URL: ORIGIN, SUPABASE_URL: 'https://x.supabase.co', SES_FROM: 'a@b.es' },
    altcha: { createChallenge, verifySolution, randomInt, deriveKey },
    sendEmail: async () => { throw new Error('no debería enviar'); },
    log: { info: (m) => estado.logs.push(m), error: (m) => estado.logs.push(m) }
  });
  const r1 = await handle({ method: 'GET', path: '/challenge', headers: cab, body: '', ip: '1.1.1.1' });
  assert.equal(r1.statusCode, 500);
  assert.equal(JSON.parse(r1.body).code, 'config');
  const r2 = await handle({ method: 'POST', path: '/lead', headers: cab, body: '{}', ip: '1.1.1.2' });
  assert.equal(r2.statusCode, 500);
  const r3 = await handle({ method: 'POST', path: '/confirmar', headers: cab, body: '{}', ip: '1.1.1.3' });
  assert.equal(r3.statusCode, 500);
  const r4 = await handle({ method: 'GET', path: '/config', headers: cab, body: '', ip: '1.1.1.4', query: { slug: 'lacasa-piloto' } });
  assert.equal(r4.statusCode, 500);
  assert.ok(estado.logs.join('').includes('ALTCHA_HMAC_SECRET'));
  assert.ok(!estado.logs.join('').includes('sb_secret'));

  const resultado = await procesarRecordatorios();
  assert.deepEqual(resultado, { procesados: 0, enviados: 0, errores: 0 });
  assert.ok(estado.logs.join('').includes('ALTCHA_HMAC_SECRET'), 'procesarRecordatorios también falla cerrado');
});

test('contacto: camino feliz, un email a CONTACT_TO con "Responder a" el remitente, sin datos personales en logs', async () => {
  const { handle, estado } = entorno();
  const r = await contactar(handle);
  assert.equal(r.statusCode, 200);
  assert.equal(estado.correos.length, 1);
  const c = estado.correos[0];
  assert.equal(c.to, 'equipo@candyads.es');
  assert.equal(c.replyTo, 'marta.prueba@example.com');
  assert.ok(c.text.includes('Marta Prueba'));
  assert.ok(!c.subject.includes('Marta Prueba'), 'el asunto no debe llevar datos personales');
  const logs = estado.logs.join('\n');
  for (const p of ['Marta Prueba', '600123456', 'marta.prueba@example.com', 'Mensaje privado 123']) {
    assert.ok(!logs.includes(p), 'log con dato personal: ' + p);
  }
});

test('contacto: validaciones básicas', async () => {
  const { handle, estado } = entorno();
  assert.equal(codigo(await contactar(handle, { privacidad: false }, '31.1.1.1')), 'privacidad');
  assert.equal(codigo(await contactar(handle, { t: 500 }, '31.1.1.2')), 'demasiado_rapido');
  assert.equal(codigo(await contactar(handle, { datos: { ...datosContactoOk(), email: 'no-es-un-email' } }, '31.1.1.3')), 'datos_formato');
  assert.equal(codigo(await contactar(handle, { datos: { ...datosContactoOk(), nombre: '' } }, '31.1.1.4')), 'datos_obligatorio');
  assert.equal(codigo(await contactar(handle, { datos: { ...datosContactoOk(), tipo: 'otra-cosa' } }, '31.1.1.5')), 'datos_opción_no_válida');
  assert.equal(codigo(await contactar(handle, { datos: { ...datosContactoOk(), extra: 'x' } }, '31.1.1.6')), 'datos_campo_no_permitido');
  assert.equal(estado.correos.length, 0);
});

test('contacto: campo trampa devuelve 200 sin enviar nada', async () => {
  const { handle, estado } = entorno();
  const r = await contactar(handle, { web_site: 'http://spam.example' }, '31.2.1.1');
  assert.equal(r.statusCode, 200);
  assert.equal(estado.correos.length, 0);
});

test('contacto: origen no permitido da 403; falta CONTACT_TO falla cerrado', async () => {
  const { handle } = entorno();
  const r = await handle({ method: 'POST', path: '/contacto', headers: { origin: 'https://malo.example' }, body: '{}', ip: '31.3.1.1' });
  assert.equal(r.statusCode, 403);

  const estado2 = { logs: [] };
  const { handle: handleSinContacto } = createHandler({
    env: { ALLOWED_ORIGIN: ORIGIN, SES_FROM: 'a@b.es' },
    altcha: { createChallenge, verifySolution, randomInt, deriveKey },
    sendEmail: async () => { throw new Error('no debería enviar'); },
    log: { info: (m) => estado2.logs.push(m), error: (m) => estado2.logs.push(m) }
  });
  const r2 = await handleSinContacto({ method: 'POST', path: '/contacto', headers: cab, body: '{}', ip: '31.3.1.2' });
  assert.equal(r2.statusCode, 500);
  assert.equal(JSON.parse(r2.body).code, 'config');
});

const DIA = 24 * 60 * 60 * 1000;

test('recordatorios: no se envía nada antes de los 15 días', async () => {
  const { handle, procesarRecordatorios, estado } = entorno();
  await enviar(handle);
  estado.reloj += 14 * DIA;
  const r = await procesarRecordatorios();
  assert.deepEqual(r, { procesados: 0, enviados: 0, errores: 0 });
  assert.equal(estado.correos.length, 1, 'solo el correo original del lead');
});

test('recordatorios: a los 15 días se envía uno, y no se repite al día siguiente', async () => {
  const { handle, procesarRecordatorios, estado } = entorno();
  await enviar(handle);
  const [ref] = [...estado.registro.keys()];
  estado.reloj += 15 * DIA;

  const r1 = await procesarRecordatorios();
  assert.deepEqual(r1, { procesados: 1, enviados: 1, errores: 0 });
  assert.equal(estado.correos.length, 2);
  const recordatorio = estado.correos[1];
  assert.equal(recordatorio.to, 'jose@lacasa.example');
  assert.ok(recordatorio.subject.includes('15 días'));
  assert.ok(recordatorio.text.includes('confirmar.html?ref=' + ref + '&r=venta'));
  assert.ok(recordatorio.text.includes('confirmar.html?ref=' + ref + '&r=sin_venta'));
  assert.equal(estado.registro.get(ref).recordatorio15, true);

  estado.reloj += 1 * DIA;
  const r2 = await procesarRecordatorios();
  assert.deepEqual(r2, { procesados: 0, enviados: 0, errores: 0 }, 'no se repite el de 15 días');
  assert.equal(estado.correos.length, 2);
});

test('recordatorios: a los 30 días se envía el segundo aviso', async () => {
  const { handle, procesarRecordatorios, estado } = entorno();
  await enviar(handle);
  const [ref] = [...estado.registro.keys()];
  estado.reloj += 15 * DIA;
  await procesarRecordatorios();
  estado.reloj += 15 * DIA; // día 30
  const r = await procesarRecordatorios();
  assert.deepEqual(r, { procesados: 1, enviados: 1, errores: 0 });
  assert.equal(estado.correos.length, 3);
  assert.ok(estado.correos[2].subject.includes('30 días'));
  assert.equal(estado.registro.get(ref).recordatorio30, true);

  estado.reloj += 5 * DIA;
  const r2 = await procesarRecordatorios();
  assert.deepEqual(r2, { procesados: 0, enviados: 0, errores: 0 }, 'no se repite el de 30 días');
});

test('recordatorios: si nunca se envió el de 15 y ya han pasado 30 días, solo se envía el de 30 (no dos)', async () => {
  const { handle, procesarRecordatorios, estado } = entorno();
  await enviar(handle);
  const [ref] = [...estado.registro.keys()];
  estado.reloj += 40 * DIA; // se saltó por completo la ventana de los 15
  const r = await procesarRecordatorios();
  assert.deepEqual(r, { procesados: 1, enviados: 1, errores: 0 });
  assert.ok(estado.correos[1].subject.includes('30 días'));
  const reg = estado.registro.get(ref);
  assert.equal(reg.recordatorio30, true);
  assert.equal(reg.recordatorio15, true, 'se cierra también el de 15 para no reintentar en bucle');

  const r2 = await procesarRecordatorios();
  assert.deepEqual(r2, { procesados: 0, enviados: 0, errores: 0 });
});

test('recordatorios: un lead ya confirmado (venta o sin venta) no recibe recordatorios', async () => {
  const { handle, procesarRecordatorios, estado } = entorno();
  await enviar(handle);
  const [ref] = [...estado.registro.keys()];
  await confirmar(handle, { ref, conversion: 'sin_venta' });
  estado.reloj += 40 * DIA;
  const r = await procesarRecordatorios();
  assert.deepEqual(r, { procesados: 0, enviados: 0, errores: 0 });
  assert.equal(estado.correos.length, 1, 'solo el correo original');
});

test('recordatorios: un lead con error de envío original no cuenta (no llegó a "enviado")', async () => {
  const { handle, procesarRecordatorios, estado } = entorno({ sesFalla: true });
  await enviar(handle);
  estado.reloj += 40 * DIA;
  const r = await procesarRecordatorios();
  assert.deepEqual(r, { procesados: 0, enviados: 0, errores: 0 });
});

test('recordatorios: no llevan ningún dato personal del lead, solo referencia y anunciante', async () => {
  const { handle, procesarRecordatorios, estado } = entorno();
  await enviar(handle);
  estado.reloj += 15 * DIA;
  await procesarRecordatorios();
  const recordatorio = estado.correos[1];
  for (const p of PERSONALES) {
    assert.ok(!recordatorio.text.includes(p), 'el recordatorio no debe llevar: ' + p);
    assert.ok(!recordatorio.html.includes(p), 'el recordatorio (html) no debe llevar: ' + p);
  }
  const logs = estado.logs.join('\n');
  for (const p of PERSONALES) assert.ok(!logs.includes(p));
});
