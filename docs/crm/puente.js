// Puente entre el CRM (este documento) y el panel de Candy Ads.
//
// El CRM va dentro de un iframe aislado del panel (sandbox SIN allow-same-origin): no puede leer la sesión
// del panel ni su almacenamiento, y su CSP le prohíbe conectarse a nada (connect-src 'none'). No tiene
// localStorage (origen opaco): CRM_STORE lo sustituye, guarda en memoria y manda cada cambio al panel,
// que es quien lee y escribe en Supabase con la sesión del admin (RLS es_admin(), doble factor).
//
// Además neutraliza los caracteres que permitirían que un texto se convirtiera en código al pintarlo
// (< > " ' ` \ y entidades &...;): el CRM construye mucho HTML a mano y así ningún dato tecleado,
// importado o guardado puede romperlo, aunque alguna plantilla se olvide de escaparlo.
(function () {
  'use strict';

  var CAMBIOS = { '<': '‹', '>': '›', '"': '”', "'": '’', '`': '´', '\\': '/' };
  function neutralizar(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/[<>"'`\\]/g, function (c) { return CAMBIOS[c]; })
      .replace(/&(?=#|[a-zA-Z][a-zA-Z0-9]*;)/g, '＆');
  }
  function neutralizarTodo(v) {
    if (typeof v === 'string') return neutralizar(v);
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = neutralizarTodo(v[i]); return v; }
    if (v && typeof v === 'object') { Object.keys(v).forEach(function (k) { v[k] = neutralizarTodo(v[k]); }); }
    return v;
  }
  window.neutralizar = neutralizar;
  window.neutralizarTodo = neutralizarTodo;

  // Al teclear o pegar: mismo número de caracteres, así el cursor no salta.
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA')) return;
    if (/^(file|checkbox|radio|range|color|date|time|datetime-local|month|week|number|hidden)$/.test(t.type)) return;
    var v = t.value, n = neutralizar(v);
    if (n === v) return;
    var a = t.selectionStart, b = t.selectionEnd;
    t.value = n;
    try { if (a != null) t.setSelectionRange(a, b); } catch (err) { /* email/tel no admiten selección */ }
  }, true);

  // Claves que se guardan en Supabase. El resto (cliente seleccionado, marca de tiempo, panel de alertas
  // abierto, token de Google…) vive solo en memoria mientras la pestaña está abierta. El token de Google,
  // si algún día se activa, nunca sale del navegador.
  var PERSISTEN = /^ncrm_(crm|plantillas|papelera|cuota|theme|docs_[A-Za-z0-9_-]+)$/;
  var datos = {};
  var puerto = null;

  function limpio(clave, valor) {
    var s = String(valor);
    if (!PERSISTEN.test(clave) || clave === 'ncrm_theme' || clave === 'ncrm_cuota') return s;
    try { return JSON.stringify(neutralizarTodo(JSON.parse(s))); } catch (e) { return neutralizar(s); }
  }

  window.CRM_STORE = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null; },
    setItem: function (k, v) {
      var s = limpio(k, v);
      if (datos[k] === s) return;
      datos[k] = s;
      if (puerto && PERSISTEN.test(k)) puerto.postMessage({ tipo: 'guardar', clave: k, valor: s });
    },
    removeItem: function (k) {
      if (!Object.prototype.hasOwnProperty.call(datos, k)) return;
      delete datos[k];
      if (puerto && PERSISTEN.test(k)) puerto.postMessage({ tipo: 'borrar', clave: k });
    }
  };

  function cargarScripts(lista, fin) {
    if (!lista.length) { fin(); return; }
    var s = document.createElement('script');
    s.src = lista[0];
    s.onload = function () { cargarScripts(lista.slice(1), fin); };
    s.onerror = function () { aviso('No se pudo cargar ' + lista[0] + '. Recarga la página.'); };
    document.body.appendChild(s);
  }

  function aviso(texto) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#F6F5FB;' +
      'font:15px Inter,system-ui,sans-serif;color:#0F0F14;padding:24px;text-align:center;z-index:99999;';
    d.textContent = texto;
    document.body.appendChild(d);
  }

  // Abierto fuera del panel (pestaña suelta): no hay datos ni sesión. No se carga nada.
  if (window.parent === window) {
    aviso('El CRM solo funciona dentro del panel del equipo de Candy Ads.');
    return;
  }

  // Peticiones del CRM al panel y respuestas (crear campaña al aceptar un presupuesto, trazabilidad de las
  // campañas de un cliente, abrir una campaña). Lo que llega del panel también se neutraliza.
  var oyentes = {};
  window.CRM_PUENTE = {
    enviar: function (tipo, datos) { if (puerto) puerto.postMessage({ tipo: tipo, datos: datos || {} }); },
    en: function (tipo, fn) { oyentes[tipo] = fn; }
  };

  var arrancado = false;
  function recibir(ev) {
    var m = ev.data || {};
    if (arrancado && typeof m.tipo === 'string' && oyentes[m.tipo]) {
      try { oyentes[m.tipo](neutralizarTodo(m.datos || {})); } catch (e) { /* un fallo de pintado no rompe el canal */ }
      return;
    }
    if (m.tipo === 'init' && !arrancado && m.datos && typeof m.datos === 'object') {
      arrancado = true;
      Object.keys(m.datos).forEach(function (k) {
        if (PERSISTEN.test(k) && typeof m.datos[k] === 'string') datos[k] = limpio(k, m.datos[k]);
      });
      cargarScripts(['vendor/chart.umd.min.js', 'vendor/xlsx.full.min.js', 'app.js?v=6', 'preventa.js?v=1'], function () {
        puerto.postMessage({ tipo: 'arrancado' });
      });
    }
  }

  // Saludo: el panel responde con un MessageChannel y a partir de ahí todo va por ese canal privado (si este
  // documento se sustituyera por otro, el canal se pierde con él).
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || puerto || !e.data || e.data.tipo !== 'crm:puerto' || !e.ports || !e.ports[0]) return;
    puerto = e.ports[0];
    puerto.onmessage = recibir;
  });
  window.parent.postMessage({ tipo: 'crm:listo' }, '*');
})();
