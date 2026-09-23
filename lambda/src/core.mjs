import { validarDatos } from './campos.mjs';
import { construirCorreo, construirCorreoRecordatorio } from './email.mjs';
import { validarContacto, construirCorreoContacto } from './contacto.mjs';
import { createHash, randomUUID } from 'node:crypto';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
const REF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 8192;
const MIN_MS = 2000;
const RL_MAX = 5;
const RL_VENTANA = 10 * 60 * 1000;
const CFG_TTL = 5 * 60 * 1000;
const CFG_TTL_NEG = 60 * 1000;
const RETO_TTL_S = 10 * 60;
const RETO_COST = 1000;
const ENV_OBLIGATORIAS = ['ALLOWED_ORIGIN', 'SITE_URL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'ALTCHA_HMAC_SECRET', 'ALTCHA_HMAC_KEY_SECRET', 'SES_FROM'];
const ENV_OBLIGATORIAS_CONTACTO = ['ALLOWED_ORIGIN', 'SES_FROM', 'CONTACT_TO'];
const ENV_OBLIGATORIAS_CONFIG = ['ALLOWED_ORIGIN', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY'];

// req: { method, path, headers (en minúsculas), body (string), ip }
// deps: { env, fetchImpl, sendEmail, altcha, now, log }
// Nada de lo que llega en `datos` se escribe en logs ni en ningún almacén: solo vive durante la petición.
export function createHandler(deps) {
  const { env, sendEmail, altcha } = deps;
  const fetchImpl = deps.fetchImpl || fetch;
  const now = deps.now || (() => Date.now());
  const log = deps.log || console;

  const limites = new Map();
  const cfgCache = new Map();

  function json(status, cuerpo, extra) {
    return {
      statusCode: status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(extra || {}) },
      body: JSON.stringify(cuerpo)
    };
  }

  function corsHeaders(origin) {
    return {
      'access-control-allow-origin': origin,
      vary: 'Origin',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    };
  }

  function excedeLimite(ip) {
    const t = now();
    if (limites.size > 5000) {
      for (const [k, v] of limites) if (t - v.desde > RL_VENTANA) limites.delete(k);
      if (limites.size > 5000) limites.clear();
    }
    const e = limites.get(ip);
    if (!e || t - e.desde > RL_VENTANA) { limites.set(ip, { desde: t, n: 1 }); return false; }
    e.n += 1;
    return e.n > RL_MAX;
  }

  async function rpc(fn, args) {
    const headers = { 'content-type': 'application/json', apikey: env.SUPABASE_SECRET_KEY };
    if (!String(env.SUPABASE_SECRET_KEY).startsWith('sb_')) headers.authorization = 'Bearer ' + env.SUPABASE_SECRET_KEY;
    const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`rpc_${fn}_${r.status}`);
    return r.json();
  }

  // Config de negocio (nombre + campos) para construir el correo del anunciante y validar el envío.
  // Lee de Supabase (misma fuente que expone /config al navegador): un cambio de ficha o de estado desde
  // el panel se aplica aquí de inmediato, sin depender del JSON estático que esto sustituye.
  async function cargarConfig(slug) {
    const hit = cfgCache.get(slug);
    if (hit && hit.exp > now()) return hit.val;
    let val = null;
    try {
      const c = await rpc('config_publico_de', { p_slug: slug });
      if (c && c.estado === 'activa' && typeof c.nombre_mostrado === 'string' && Array.isArray(c.campos)) {
        val = { nombre: c.nombre_mostrado, campos: c.campos.filter((x) => typeof x === 'string') };
      }
    } catch { /* se trata como no disponible */ }
    cfgCache.set(slug, { val, exp: now() + (val ? CFG_TTL : CFG_TTL_NEG) });
    return val;
  }

  // Config pública para /lead/<slug>: a diferencia de cargarConfig (uso interno, con caché), esta va sin
  // caché porque la pide el navegador directamente y debe reflejar un cambio de estado al instante.
  async function configPublica(req, cors) {
    const fin = (status, cuerpo) => json(status, cuerpo, cors);
    const slug = String((req.query && req.query.slug) || '');
    if (!SLUG_RE.test(slug)) return fin(400, { ok: false, code: 'slug' });
    let c;
    try {
      c = await rpc('config_publico_de', { p_slug: slug });
    } catch (e) {
      log.error(JSON.stringify({ evt: 'config_error', slug, error: (e && e.message) || 'error' }));
      return fin(500, { ok: false, code: 'interno' });
    }
    if (!c) return fin(404, { ok: false, code: 'no_encontrado' });
    if (c.estado !== 'activa') return fin(200, { estado: c.estado });
    return fin(200, {
      estado: c.estado,
      nombre_mostrado: c.nombre_mostrado,
      campos: c.campos,
      tema: { color: c.tema_color, color_secundario: c.tema_color_secundario, logo: c.tema_logo },
      razon_social: c.razon_social,
      nif_cif: c.cif,
      email_privacidad: c.email_privacidad
    });
  }

  async function crearReto() {
    const cost = Number(env.ALTCHA_COST) || RETO_COST;
    const reto = await altcha.createChallenge({
      algorithm: 'PBKDF2/SHA-256',
      cost,
      counter: altcha.randomInt(cost, cost * 2),
      deriveKey: altcha.deriveKey,
      hmacSignatureSecret: env.ALTCHA_HMAC_SECRET,
      hmacKeySignatureSecret: env.ALTCHA_HMAC_KEY_SECRET,
      expiresAt: Math.floor(now() / 1000) + RETO_TTL_S
    });
    return reto;
  }

  async function verificarAltcha(b64) {
    let payload;
    try {
      if (typeof b64 !== 'string' || b64.length > 4096) return null;
      payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (!payload || !payload.challenge || !payload.solution) return null;
    } catch { return null; }
    let res;
    try {
      res = await altcha.verifySolution({
        challenge: payload.challenge,
        solution: payload.solution,
        deriveKey: altcha.deriveKey,
        hmacSignatureSecret: env.ALTCHA_HMAC_SECRET,
        hmacKeySignatureSecret: env.ALTCHA_HMAC_KEY_SECRET
      });
    } catch { return null; }
    if (!res || !res.verified) return null;
    const p = payload.challenge.parameters;
    return {
      huella: createHash('sha256').update(String(p.nonce)).digest('hex'),
      expira: new Date((p.expiresAt || Math.floor(now() / 1000) + RETO_TTL_S) * 1000).toISOString()
    };
  }

  async function lead(req, cors) {
    const fin = (status, code, slug) => {
      log.info(JSON.stringify({ evt: 'lead', slug: slug || null, status, code }));
      return json(status, status === 200 ? { ok: true } : { ok: false, code }, cors);
    };

    if (req.body.length > MAX_BODY) return fin(413, 'demasiado_grande');
    let b;
    try { b = JSON.parse(req.body); } catch { return fin(400, 'json'); }
    if (!b || typeof b !== 'object') return fin(400, 'json');

    if (excedeLimite(req.ip || 'desconocida')) return fin(429, 'limite_ip');

    const slug = String(b.slug || '');
    if (!SLUG_RE.test(slug)) return fin(400, 'slug');
    if (b.consentimiento !== true) return fin(400, 'consentimiento');
    if (typeof b.t !== 'number' || b.t < MIN_MS) return fin(400, 'demasiado_rapido', slug);

    const cfg = await cargarConfig(slug);
    if (!cfg) return fin(404, 'no_disponible', slug);

    const v = validarDatos(cfg.campos, b.datos);
    if (!v.ok) return fin(400, 'datos_' + v.motivo.replace(/\s+/g, '_'), slug);

    const reto = await verificarAltcha(b.altcha);
    if (!reto) return fin(400, 'altcha', slug);

    try {
      const destino = await rpc('destino_de', { p_slug: slug });
      if (!destino) return fin(404, 'sin_destino', slug);

      const nuevo = await rpc('consumir_reto', { p_huella: reto.huella, p_expira: reto.expira });
      if (nuevo !== true) return fin(400, 'altcha_reutilizado', slug);

      const ref = randomUUID();
      const reservado = await rpc('reservar_lead_ref', { p_slug: slug, p_ref: ref });
      if (reservado !== true) return fin(429, 'limite_diario', slug);

      const correo = construirCorreo({ nombreAnunciante: cfg.nombre, datos: v.datos, ahora: now(), referencia: ref.slice(0, 8).toUpperCase(), refCompleta: ref, sitio: env.SITE_URL });
      let envio;
      try {
        envio = await sendEmail({ from: env.SES_FROM, to: destino, replyTo: correo.replyTo, subject: correo.subject, text: correo.text, html: correo.html });
      } catch (e) {
        try { await rpc('fallar_lead_ref', { p_ref: ref }); } catch { /* el registro queda 'pendiente': se ve en el panel */ }
        log.error(JSON.stringify({ evt: 'lead_envio_fallido', slug, error: (e && e.name) || 'error' }));
        return fin(502, 'envio', slug);
      }
      try { await rpc('confirmar_lead_ref', { p_ref: ref, p_mensaje: String((envio && envio.messageId) || '') }); }
      catch (e) { log.error(JSON.stringify({ evt: 'lead_confirmacion_fallida', slug, error: (e && e.message) || 'error' })); }
    } catch (e) {
      log.error(JSON.stringify({ evt: 'lead_error', slug, error: (e && e.message) || 'error' }));
      return fin(500, 'interno', slug);
    }
    return fin(200, 'ok', slug);
  }

  // El anunciante confirma desde el correo, con un clic, si ese lead terminó en venta. Solo identifica el
  // envío por su referencia aleatoria: no hay dato de la persona en esta ruta.
  async function confirmar(req, cors) {
    const fin = (status, code) => {
      log.info(JSON.stringify({ evt: 'confirmar', status, code }));
      return json(status, status === 200 ? { ok: true } : { ok: false, code }, cors);
    };

    if (req.body.length > MAX_BODY) return fin(413, 'demasiado_grande');
    let b;
    try { b = JSON.parse(req.body); } catch { return fin(400, 'json'); }
    if (!b || typeof b !== 'object') return fin(400, 'json');

    if (excedeLimite(req.ip || 'desconocida')) return fin(429, 'limite_ip');

    const ref = String(b.ref || '');
    if (!REF_RE.test(ref)) return fin(400, 'ref');
    const conversion = String(b.conversion || '');
    if (conversion !== 'venta' && conversion !== 'sin_venta') return fin(400, 'conversion');

    try {
      const ok = await rpc('marcar_conversion', { p_ref: ref, p_conversion: conversion });
      if (ok !== true) return fin(404, 'no_encontrado');
    } catch (e) {
      log.error(JSON.stringify({ evt: 'confirmar_error', error: (e && e.message) || 'error' }));
      return fin(500, 'interno');
    }
    return fin(200, 'ok');
  }

  // Formulario de contacto de la landing (sustituye a Formspree). No guarda nada: solo envía un correo
  // a equipo@candyads.es con "Responder a" = quien escribe.
  async function contactar(req, cors) {
    const fin = (status, code) => {
      log.info(JSON.stringify({ evt: 'contacto', status, code }));
      return json(status, status === 200 ? { ok: true } : { ok: false, code }, cors);
    };

    if (req.body.length > MAX_BODY) return fin(413, 'demasiado_grande');
    let b;
    try { b = JSON.parse(req.body); } catch { return fin(400, 'json'); }
    if (!b || typeof b !== 'object') return fin(400, 'json');

    if (excedeLimite(req.ip || 'desconocida')) return fin(429, 'limite_ip');

    // Campo trampa: si un robot lo rellena, respondemos como si hubiera ido bien pero no enviamos nada.
    if (b.web_site) return fin(200, 'ok');
    if (typeof b.t !== 'number' || b.t < MIN_MS) return fin(400, 'demasiado_rapido');
    if (b.privacidad !== true) return fin(400, 'privacidad');

    const v = validarContacto(b.datos);
    if (!v.ok) return fin(400, 'datos_' + v.motivo.replace(/\s+/g, '_'));

    try {
      const correo = construirCorreoContacto({ datos: v.datos, ahora: now() });
      await sendEmail({ from: env.SES_FROM, to: env.CONTACT_TO, replyTo: correo.replyTo, subject: correo.subject, text: correo.text, html: correo.html });
    } catch (e) {
      log.error(JSON.stringify({ evt: 'contacto_envio_fallido', error: (e && e.name) || 'error' }));
      return fin(502, 'envio');
    }
    return fin(200, 'ok');
  }

  // Recordatorios de confirmación de venta (15 y 30 días). No lo dispara nadie por HTTP: lo invoca una
  // tarea programada (EventBridge) directamente sobre la Lambda. Recorre los leads que Supabase señala
  // como pendientes, envía como mucho un correo por lead en esta pasada, y marca cada aviso enviado para
  // no repetirlo. Un fallo en un lead no bloquea los demás.
  async function procesarRecordatorios() {
    const faltan = ENV_OBLIGATORIAS.filter((k) => !env[k]);
    if (faltan.length) {
      log.error(JSON.stringify({ evt: 'config_incompleta', faltan }));
      return { procesados: 0, enviados: 0, errores: 0 };
    }

    let filas;
    try {
      filas = await rpc('leads_pendientes_recordatorio', {});
    } catch (e) {
      log.error(JSON.stringify({ evt: 'recordatorios_error', error: (e && e.message) || 'error' }));
      return { procesados: 0, enviados: 0, errores: 1 };
    }

    let enviados = 0;
    let errores = 0;
    for (const fila of filas || []) {
      try {
        const cfg = await cargarConfig(fila.anunciante_slug);
        const nombre = (cfg && cfg.nombre) || fila.anunciante_slug;
        const correo = construirCorreoRecordatorio({
          nombreAnunciante: nombre,
          referencia: fila.referencia,
          refCompleta: fila.ref,
          sitio: env.SITE_URL,
          dias: fila.tipo
        });
        await sendEmail({ from: env.SES_FROM, to: fila.destino, subject: correo.subject, text: correo.text, html: correo.html });
        await rpc('marcar_recordatorio_enviado', { p_ref: fila.ref, p_tipo: fila.tipo });
        enviados += 1;
        log.info(JSON.stringify({ evt: 'recordatorio', slug: fila.anunciante_slug, tipo: fila.tipo, status: 200 }));
      } catch (e) {
        errores += 1;
        log.error(JSON.stringify({ evt: 'recordatorio_error', slug: fila.anunciante_slug, tipo: fila.tipo, error: (e && e.name) || (e && e.message) || 'error' }));
      }
    }
    return { procesados: (filas || []).length, enviados, errores };
  }

  async function handle(req) {
    const origin = req.headers.origin || '';
    const permitido = origin === env.ALLOWED_ORIGIN;
    const cors = permitido ? corsHeaders(origin) : {};

    if (req.method === 'OPTIONS') {
      return permitido ? { statusCode: 204, headers: cors, body: '' } : json(403, { ok: false, code: 'origen' });
    }
    if (!permitido) return json(403, { ok: false, code: 'origen' });

    const faltan = ENV_OBLIGATORIAS.filter((k) => !env[k]);
    if (faltan.length && (req.path.endsWith('/challenge') || req.path.endsWith('/lead') || req.path.endsWith('/confirmar'))) {
      log.error(JSON.stringify({ evt: 'config_incompleta', faltan }));
      return json(500, { ok: false, code: 'config' }, cors);
    }
    const faltanContacto = ENV_OBLIGATORIAS_CONTACTO.filter((k) => !env[k]);
    if (faltanContacto.length && req.path.endsWith('/contacto')) {
      log.error(JSON.stringify({ evt: 'config_incompleta', faltan: faltanContacto }));
      return json(500, { ok: false, code: 'config' }, cors);
    }
    const faltanConfig = ENV_OBLIGATORIAS_CONFIG.filter((k) => !env[k]);
    if (faltanConfig.length && req.path.endsWith('/config')) {
      log.error(JSON.stringify({ evt: 'config_incompleta', faltan: faltanConfig }));
      return json(500, { ok: false, code: 'config' }, cors);
    }

    if (req.method === 'GET' && req.path.endsWith('/challenge')) {
      try { return json(200, await crearReto(), cors); }
      catch (e) { log.error(JSON.stringify({ evt: 'reto_error', error: (e && e.name) || 'error' })); return json(500, { ok: false, code: 'interno' }, cors); }
    }
    if (req.method === 'GET' && req.path.endsWith('/config')) return configPublica(req, cors);
    if (req.method === 'POST' && req.path.endsWith('/lead')) return lead(req, cors);
    if (req.method === 'POST' && req.path.endsWith('/confirmar')) return confirmar(req, cors);
    if (req.method === 'POST' && req.path.endsWith('/contacto')) return contactar(req, cors);
    return json(404, { ok: false, code: 'ruta' }, cors);
  }

  return { handle, procesarRecordatorios };
}
