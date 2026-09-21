export const CATALOGO = {
  nombre: { label: 'Nombre', type: 'text', required: true, max: 80 },
  telefono: { label: 'Teléfono', type: 'tel', required: true, max: 20 },
  email: { label: 'Email', type: 'email', required: false, max: 120 },
  interes_venta_alquiler: {
    label: 'Interés', type: 'select', required: true,
    options: ['Quiero vender mi vivienda', 'Quiero alquilar mi vivienda', 'Busco comprar', 'Busco alquilar', 'Otra consulta']
  },
  mensaje: { label: 'Mensaje', type: 'textarea', required: false, max: 500 }
};

const CONTROL = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]', 'g');

function limpiar(v, multilinea) {
  let s = String(v).replace(/\r\n?/g, '\n').replace(CONTROL, '');
  if (!multilinea) s = s.replace(/\n/g, ' ');
  return s.trim();
}

function validarUno(def, v) {
  if (!v) return def.required ? 'obligatorio' : '';
  if (def.max && v.length > def.max) return 'demasiado largo';
  if (def.type === 'tel') {
    const d = v.replace(/\D/g, '');
    if (!/^\+?[0-9 ()\-]+$/.test(v) || d.length < 9 || d.length > 15) return 'formato';
  }
  if (def.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'formato';
  if (def.type === 'select' && !def.options.includes(v)) return 'opción no válida';
  return '';
}

// campos: lista permitida para este anunciante. datos: lo que envía el navegador.
// Devuelve { ok:true, datos } con los valores limpios, o { ok:false, campo, motivo }.
export function validarDatos(campos, datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return { ok: false, campo: '*', motivo: 'formato' };
  const permitidos = campos.filter((id) => CATALOGO[id]);
  for (const k of Object.keys(datos)) {
    if (!permitidos.includes(k)) return { ok: false, campo: k, motivo: 'campo no permitido' };
  }
  const limpios = {};
  for (const id of permitidos) {
    const def = CATALOGO[id];
    const crudo = datos[id];
    if (crudo != null && typeof crudo !== 'string') return { ok: false, campo: id, motivo: 'formato' };
    const v = limpiar(crudo ?? '', def.type === 'textarea');
    const motivo = validarUno(def, v);
    if (motivo) return { ok: false, campo: id, motivo };
    limpios[id] = v;
  }
  return { ok: true, datos: limpios };
}
