// Formulario público de una campaña: definición de campos, pintado y comprobación en el navegador.
// Lo usan /lead/<slug> (lead.js) y la vista previa de la ficha en el panel (campanas.js), así lo que se ve en
// el panel es exactamente lo que verá quien escanee el QR. La barrera de verdad está en la Lambda
// (lambda/src/campos.mjs, mismas reglas): esto solo ayuda a rellenarlo bien.
(function () {
  'use strict';

  var TIPOS = {
    text: 'Texto', textarea: 'Texto largo', tel: 'Teléfono', email: 'Email',
    numero: 'Número', fecha: 'Fecha', select: 'Desplegable', checkbox: 'Casilla'
  };
  var MAX_TIPO = { text: 120, textarea: 1000, tel: 20, email: 120, numero: 20, fecha: 10, select: 200, checkbox: 10 };
  var KEY_RE = /^[a-z0-9_]{1,40}$/;
  var ERRORES = {
    tel: 'Escribe un teléfono válido', email: 'Escribe un email válido', numero: 'Escribe un número',
    fecha: 'Elige una fecha', select: 'Elige una opción', checkbox: 'Marca esta casilla'
  };
  var AUTOCOMPLETE = { nombre: 'given-name', apellidos: 'family-name', telefono: 'tel', email: 'email', cp: 'postal-code' };

  // Campos de antes de campos_formulario (columna "campos", solo claves). Se siguen entendiendo para no romper
  // las campañas que aún no se han editado con el editor nuevo. Igual que CATALOGO en lambda/src/campos.mjs.
  var LEGADO = {
    nombre: { label: 'Nombre', tipo: 'text', obligatorio: true, max: 80 },
    telefono: { label: 'Teléfono', tipo: 'tel', obligatorio: true },
    email: { label: 'Email', tipo: 'email', obligatorio: false },
    interes_venta_alquiler: { label: '¿Qué necesitas?', tipo: 'select', obligatorio: true,
      opciones: ['Quiero vender mi vivienda', 'Quiero alquilar mi vivienda', 'Busco comprar', 'Busco alquilar', 'Otra consulta'] },
    mensaje: { label: 'Mensaje', tipo: 'textarea', obligatorio: false, max: 500 }
  };

  // Plantilla de una campaña nueva: los cinco campos comunes, activados y desactivables uno a uno en la ficha.
  var COMUNES = [
    { key: 'nombre', label: 'Nombre', tipo: 'text', obligatorio: true },
    { key: 'apellidos', label: 'Apellidos', tipo: 'text', obligatorio: false },
    { key: 'telefono', label: 'Teléfono', tipo: 'tel', obligatorio: true },
    { key: 'email', label: 'Email', tipo: 'email', obligatorio: false },
    { key: 'cp', label: 'Código postal', tipo: 'text', obligatorio: false }
  ];

  function copia(d) {
    var c = { key: d.key, label: d.label, tipo: d.tipo, obligatorio: d.obligatorio === true };
    if (d.tipo === 'select') c.opciones = d.opciones.slice();
    if (d.max) c.max = d.max;
    return c;
  }

  // Lista de campos de una campaña: cfg.formulario (lo que manda la Lambda) o campos_formulario (el panel);
  // si no hay, la lista antigua de claves traducida con LEGADO. Descarta definiciones mal formadas.
  function normalizar(cfg) {
    var lista = [];
    if (Array.isArray(cfg.formulario) && cfg.formulario.length) lista = cfg.formulario;
    else if (Array.isArray(cfg.campos_formulario) && cfg.campos_formulario.length) lista = cfg.campos_formulario;
    else if (Array.isArray(cfg.campos)) {
      lista = cfg.campos.filter(function (k) { return typeof k === 'string' && LEGADO[k]; })
        .map(function (k) { var d = copia(Object.assign({ key: k }, LEGADO[k])); return d; });
    }
    var vistos = {}, out = [];
    lista.forEach(function (d) {
      if (!d || !KEY_RE.test(d.key) || vistos[d.key] || !TIPOS[d.tipo] || typeof d.label !== 'string' || !d.label.trim()) return;
      if (d.tipo === 'select' && !(Array.isArray(d.opciones) && d.opciones.length)) return;
      vistos[d.key] = true;
      out.push(copia(d));
    });
    return out;
  }

  // Clave de un campo personalizado a partir de su etiqueta: minúsculas, sin acentos ni espacios, única.
  function claveDe(label, existentes) {
    var base = String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'campo';
    var k = base, n = 2;
    while (existentes.indexOf(k) !== -1) { k = base + '_' + n; n++; }
    return k;
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }

  // Pinta los campos dentro de `form` (antes de `antesDe`, si se da). prefijo: para ids únicos en el panel.
  function pintar(form, defs, antesDe, prefijo) {
    var p = prefijo || 'f-';
    defs.forEach(function (d) {
      var id = p + d.key;
      var wrap = el('div', { 'class': 'field' + (d.tipo === 'checkbox' ? ' check-field' : ''), 'data-id': d.key });
      var ctl;
      if (d.tipo === 'checkbox') {
        var fila = el('div', { 'class': 'check-fila' });
        ctl = el('input', { id: id, name: d.key, type: 'checkbox', value: 'Sí' });
        var l = el('label', { 'for': id }, d.label);
        if (!d.obligatorio) l.appendChild(el('span', { 'class': 'opt' }, ' (opcional)'));
        fila.appendChild(ctl); fila.appendChild(l);
        wrap.appendChild(fila);
      } else {
        var lbl = el('label', { 'class': 'lbl', 'for': id }, d.label);
        if (!d.obligatorio) lbl.appendChild(el('span', { 'class': 'opt' }, ' (opcional)'));
        wrap.appendChild(lbl);
        var max = String(d.max || MAX_TIPO[d.tipo]);
        if (d.tipo === 'select') {
          ctl = el('select', { id: id, name: d.key });
          ctl.appendChild(el('option', { value: '' }, 'Selecciona…'));
          d.opciones.forEach(function (o) { ctl.appendChild(el('option', { value: o }, o)); });
        } else if (d.tipo === 'textarea') {
          ctl = el('textarea', { id: id, name: d.key, maxlength: max });
        } else {
          var tipo = { tel: 'tel', email: 'email', fecha: 'date' }[d.tipo] || 'text';
          ctl = el('input', { id: id, name: d.key, type: tipo, maxlength: max });
          if (d.tipo === 'tel') ctl.setAttribute('inputmode', 'tel');
          if (d.tipo === 'numero') ctl.setAttribute('inputmode', 'decimal');
          if (AUTOCOMPLETE[d.key]) ctl.setAttribute('autocomplete', AUTOCOMPLETE[d.key]);
        }
        wrap.appendChild(ctl);
      }
      ctl.setAttribute('aria-describedby', 'err-' + id);
      wrap.appendChild(el('p', { 'class': 'msg-err', id: 'err-' + id }, ERRORES[d.tipo] || 'Rellena este campo'));
      if (antesDe) form.insertBefore(wrap, antesDe); else form.appendChild(wrap);
    });
  }

  function error(d, v) {
    if (!v) return d.obligatorio ? 'obligatorio' : '';
    if (v.length > (d.max || MAX_TIPO[d.tipo])) return 'largo';
    if (d.tipo === 'tel') {
      var n = v.replace(/\D/g, '');
      if (!/^\+?[0-9 ()\-]+$/.test(v) || n.length < 9 || n.length > 15) return 'formato';
    }
    if (d.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'formato';
    if (d.tipo === 'numero' && !/^-?\d+([.,]\d+)?$/.test(v)) return 'formato';
    if (d.tipo === 'fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'formato';
    if (d.tipo === 'select' && d.opciones.indexOf(v) === -1) return 'formato';
    return '';
  }

  // Lee y comprueba los campos: { datos, primero } — primero = primer control con error (o null).
  function leer(form, defs) {
    var datos = {}, primero = null;
    defs.forEach(function (d) {
      var ctl = form.elements[d.key];
      if (!ctl) return;
      var v = d.tipo === 'checkbox' ? (ctl.checked ? 'Sí' : '') : String(ctl.value || '').trim();
      var mal = !!error(d, v);
      ctl.closest('.field').classList.toggle('invalid', mal);
      if (mal && !primero) primero = ctl;
      datos[d.key] = v;
    });
    return { datos: datos, primero: primero };
  }

  window.CandyFormulario = {
    TIPOS: TIPOS, COMUNES: COMUNES, LEGADO: LEGADO,
    normalizar: normalizar, claveDe: claveDe, pintar: pintar, leer: leer, copia: copia
  };
})();
