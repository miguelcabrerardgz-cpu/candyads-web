import { CATALOGO } from './campos.mjs';

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fechaMadrid(ms) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'medium'
  }).format(new Date(ms));
}

const AVISO = 'Este mensaje contiene datos personales que la persona interesada ha enviado voluntariamente para que la contactes. ' +
  'Candy Ads solo actúa como intermediario técnico y no conserva copia de estos datos. ' +
  'Tú eres el responsable de su tratamiento.';

// Devuelve el correo listo para enviar. No incluye datos personales en el asunto.
// `refCompleta`, si se da, añade dos enlaces de un clic (sin login) para que el anunciante confirme si el
// contacto terminó en venta. El enlace solo lleva la referencia aleatoria: no identifica a la persona.
export function construirCorreo({ nombreAnunciante, datos, ahora, referencia, refCompleta, sitio }) {
  const base = String(sitio || 'https://candyads.es').replace(/\/+$/, '');
  const filas = Object.keys(datos)
    .filter((id) => CATALOGO[id] && datos[id])
    .map((id) => ({ etiqueta: CATALOGO[id].label, valor: datos[id] }));

  const confirmar = refCompleta
    ? {
        venta: `${base}/confirmar.html?ref=${encodeURIComponent(refCompleta)}&r=venta`,
        sinVenta: `${base}/confirmar.html?ref=${encodeURIComponent(refCompleta)}&r=sin_venta`
      }
    : null;

  const texto = [
    `Nuevo contacto para ${nombreAnunciante}`,
    `Recibido el ${fechaMadrid(ahora)}`,
    ...(referencia ? [`Referencia: ${referencia}`] : []),
    '',
    ...filas.map((f) => `${f.etiqueta}: ${f.valor}`),
    '',
    AVISO,
    ...(confirmar
      ? ['', '¿Este contacto terminó en venta? Un clic, no hace falta contestar:',
        `Sí, fue venta: ${confirmar.venta}`,
        `No, de momento no: ${confirmar.sinVenta}`]
      : [])
  ].join('\n');

  const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#2D2D3A;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#ffffff;border:1px solid #E4E4EF;border-radius:12px;padding:24px;">
<p style="margin:0 0 14px;line-height:0;"><img src="${esc(base)}/assets/candyads-icono.png" alt="Candy Ads" width="44" height="44" style="display:inline-block;vertical-align:middle;border:0;"><img src="${esc(base)}/assets/candyads-logotipo.jpg" alt="" width="74" height="31" style="display:inline-block;vertical-align:middle;border:0;margin-left:-4px;"></p>
<h1 style="margin:0 0 6px;font-size:22px;color:#0F0F14;">Nuevo contacto para ${esc(nombreAnunciante)}</h1>
<p style="margin:0 0 18px;font-size:13px;color:#6B6B80;">Recibido el ${esc(fechaMadrid(ahora))}${referencia ? ` &middot; Ref. ${esc(referencia)}` : ''}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;">
${filas.map((f) => `<tr><td style="padding:9px 0;border-top:1px solid #E4E4EF;font-size:13px;color:#6B6B80;width:38%;vertical-align:top;">${esc(f.etiqueta)}</td><td style="padding:9px 0;border-top:1px solid #E4E4EF;font-size:15px;color:#0F0F14;white-space:pre-wrap;">${esc(f.valor)}</td></tr>`).join('\n')}
</table>
<p style="margin:18px 0 0;font-size:12px;color:#6B6B80;line-height:1.5;">${esc(AVISO)}</p>
${confirmar ? `<p style="margin:14px 0 0;padding-top:14px;border-top:1px solid #E4E4EF;font-size:11px;color:#9CA3AF;">&iquest;Termin&oacute; en venta? <a href="${esc(confirmar.venta)}" style="color:#7C3AED;">S&iacute;</a> &middot; <a href="${esc(confirmar.sinVenta)}" style="color:#7C3AED;">No, de momento</a></p>` : ''}
</div></div></body></html>`;

  return {
    subject: 'Nuevo contacto desde tu sobre de Candy Ads',
    text: texto,
    html,
    replyTo: datos.email || undefined
  };
}
