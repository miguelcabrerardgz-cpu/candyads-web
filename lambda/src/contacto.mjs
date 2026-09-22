import { validarConCatalogo } from './campos.mjs';
import { esc } from './email.mjs';

// Catálogo propio del formulario de contacto de la landing (distinto del de leads: aquí el email es
// obligatorio y el teléfono no). Fijo para todos los envíos, no depende de ningún anunciante.
const CATALOGO_CONTACTO = {
  nombre: { label: 'Nombre', type: 'text', required: true, max: 80 },
  empresa: { label: 'Empresa', type: 'text', required: false, max: 120 },
  tipo: { label: 'Soy', type: 'select', required: false, options: ['anunciante', 'bar', 'info'] },
  telefono: { label: 'Teléfono', type: 'tel', required: false, max: 20 },
  email: { label: 'Email', type: 'email', required: true, max: 120 },
  mensaje: { label: 'Mensaje', type: 'textarea', required: false, max: 2000 }
};
const CAMPOS_PERMITIDOS = Object.keys(CATALOGO_CONTACTO);
const ETIQUETA_TIPO = { anunciante: 'Quiero anunciar mi negocio', bar: 'Tengo un bar o cafetería', info: 'Información general' };

export function validarContacto(datos) {
  return validarConCatalogo(CATALOGO_CONTACTO, CAMPOS_PERMITIDOS, datos);
}

function fechaMadrid(ms) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', dateStyle: 'long', timeStyle: 'medium'
  }).format(new Date(ms));
}

// Devuelve el correo listo para enviar a equipo@candyads.es con el mensaje de contacto de la landing.
export function construirCorreoContacto({ datos, ahora }) {
  const filas = [
    { etiqueta: 'Nombre', valor: datos.nombre },
    ...(datos.empresa ? [{ etiqueta: 'Empresa', valor: datos.empresa }] : []),
    ...(datos.tipo ? [{ etiqueta: 'Soy', valor: ETIQUETA_TIPO[datos.tipo] || datos.tipo }] : []),
    { etiqueta: 'Email', valor: datos.email },
    ...(datos.telefono ? [{ etiqueta: 'Teléfono', valor: datos.telefono }] : []),
    ...(datos.mensaje ? [{ etiqueta: 'Mensaje', valor: datos.mensaje }] : [])
  ];

  const texto = [
    'Nuevo mensaje desde el formulario de contacto de candyads.es',
    `Recibido el ${fechaMadrid(ahora)}`,
    '',
    ...filas.map((f) => `${f.etiqueta}: ${f.valor}`)
  ].join('\n');

  const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#2D2D3A;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#ffffff;border:1px solid #E4E4EF;border-radius:12px;padding:24px;">
<p style="margin:0 0 14px;line-height:0;"><img src="https://candyads.es/assets/candyads-icono.png" alt="Candy Ads" width="44" height="44" style="display:inline-block;vertical-align:middle;border:0;"><img src="https://candyads.es/assets/candyads-logotipo.jpg" alt="" width="74" height="31" style="display:inline-block;vertical-align:middle;border:0;margin-left:-4px;"></p>
<h1 style="margin:0 0 6px;font-size:22px;color:#0F0F14;">Nuevo mensaje de contacto</h1>
<p style="margin:0 0 18px;font-size:13px;color:#6B6B80;">Recibido el ${esc(fechaMadrid(ahora))}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;">
${filas.map((f) => `<tr><td style="padding:9px 0;border-top:1px solid #E4E4EF;font-size:13px;color:#6B6B80;width:32%;vertical-align:top;">${esc(f.etiqueta)}</td><td style="padding:9px 0;border-top:1px solid #E4E4EF;font-size:15px;color:#0F0F14;white-space:pre-wrap;">${esc(f.valor)}</td></tr>`).join('\n')}
</table>
</div></div></body></html>`;

  return {
    subject: 'Nuevo contacto desde candyads.es',
    text: texto,
    html,
    replyTo: datos.email
  };
}
