import { validarDatos } from './campos.mjs';
import { construirCorreo } from './email.mjs';
import { createHash, randomUUID } from 'node:crypto';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
const MAX_BODY = 8192;
const MIN_MS = 2000;
const RL_MAX = 5;
const RL_VENTANA = 10 * 60 * 1000;
const CFG_TTL = 5 * 60 * 1000;
const CFG_TTL_NEG = 60 * 1000;
const RETO_TTL_S = 10 * 60;
const RETO_COST = 1000;
const ENV_OBLIGATORIAS = ['ALLOWED_ORIGIN', 'SITE_URL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'ALTCHA_HMAC_SECRET', 'ALTCHA_HMAC_KEY_SECRET', 'SES_FROM'];

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

  async function cargarConfig(slug) {
    const hit = cfgCache.get(slug);
    if (hit && hit.exp > now()) return hit.val;
    let val = null;
    try {
      const r = await fetchImpl(`${env.SITE_URL}/data/anunciantes/${slug}.json`, { headers: { accept: 'application/json' } });
      if (r.ok) {
        const c = await r.json();
        if (c && c.activo !== false && typeof c.nombre_mostrado === 'string' && Array.isArray(c.campos)) {
          val = { nombre: c.nombre_mostrado, campos: c.campos.filter((x) => typeof x === 'string') };
        }
      }
    } catch { /* se trata como no disponible */ }
    cfgCache.set(slug, { val, exp: now() + (val ? CFG_TTL : CFG_TTL_NEG) });
    return val;
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

      const correo = construirCorreo({ nombreAnunciante: cfg.nombre, datos: v.datos, ahora: now(), referencia: ref.slice(0, 8).toUpperCase() });
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

  return async function handle(req) {
    const origin = req.headers.origin || '';
    const permitido = origin === env.ALLOWED_ORIGIN;
    const cors = permitido ? corsHeaders(origin) : {};

    if (req.method === 'OPTIONS') {
      return permitido ? { statusCode: 204, headers: cors, body: '' } : json(403, { ok: false, code: 'origen' });
    }
    if (!permitido) return json(403, { ok: false, code: 'origen' });

    const faltan = ENV_OBLIGATORIAS.filter((k) => !env[k]);
    if (faltan.length && (req.path.endsWith('/challenge') || req.path.endsWith('/lead'))) {
      log.error(JSON.stringify({ evt: 'config_incompleta', faltan }));
      return json(500, { ok: false, code: 'config' }, cors);
    }

    if (req.method === 'GET' && req.path.endsWith('/challenge')) {
      try { return json(200, await crearReto(), cors); }
      catch (e) { log.error(JSON.stringify({ evt: 'reto_error', error: (e && e.name) || 'error' })); return json(500, { ok: false, code: 'interno' }, cors); }
    }
    if (req.method === 'POST' && req.path.endsWith('/lead')) return lead(req, cors);
    return json(404, { ok: false, code: 'ruta' }, cors);
  };
}
