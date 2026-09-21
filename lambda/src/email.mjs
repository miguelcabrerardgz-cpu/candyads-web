import { CATALOGO } from './campos.mjs';

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fechaMadrid(ms) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'short'
  }).format(new Date(ms));
}

const AVISO = 'Este mensaje contiene datos personales que la persona interesada ha enviado voluntariamente para que la contactes. ' +
  'Candy Ads solo actúa como intermediario técnico y no conserva copia de estos datos. ' +
  'Tú eres el responsable de su tratamiento.';

// Devuelve el correo listo para enviar. No incluye datos personales en el asunto.
export function construirCorreo({ nombreAnunciante, datos, ahora }) {
  const filas = Object.keys(datos)
    .filter((id) => CATALOGO[id] && datos[id])
    .map((id) => ({ etiqueta: CATALOGO[id].label, valor: datos[id] }));

  const texto = [
    `Nuevo contacto para ${nombreAnunciante}`,
    `Recibido el ${fechaMadrid(ahora)}`,
    '',
    ...filas.map((f) => `${f.etiqueta}: ${f.valor}`),
    '',
    AVISO
  ].join('\n');

  const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#2D2D3A;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#ffffff;border:1px solid #E4E4EF;border-radius:12px;padding:24px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#7C3AED;font-weight:700;">Candy Ads</p>
<h1 style="margin:0 0 6px;font-size:22px;color:#0F0F14;">Nuevo contacto para ${esc(nombreAnunciante)}</h1>
<p style="margin:0 0 18px;font-size:13px;color:#6B6B80;">Recibido el ${esc(fechaMadrid(ahora))}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;">
${filas.map((f) => `<tr><td style="padding:9px 0;border-top:1px solid #E4E4EF;font-size:13px;color:#6B6B80;width:38%;vertical-align:top;">${esc(f.etiqueta)}</td><td style="padding:9px 0;border-top:1px solid #E4E4EF;font-size:15px;color:#0F0F14;white-space:pre-wrap;">${esc(f.valor)}</td></tr>`).join('\n')}
</table>
<p style="margin:18px 0 0;font-size:12px;color:#6B6B80;line-height:1.5;">${esc(AVISO)}</p>
</div></div></body></html>`;

  return {
    subject: 'Nuevo contacto desde tu sobre de Candy Ads',
    text: texto,
    html,
    replyTo: datos.email || undefined
  };
}
