// Herramienta: CRM comercial (docs/crm). Va en un iframe aislado (sandbox SIN allow-same-origin): el CRM no
// puede leer la sesión del panel ni conectarse a nada. Este archivo es el único que habla con Supabase:
// carga sus datos al abrirlo, se los pasa por un canal privado (MessageChannel) y guarda lo que el CRM le
// manda, con control de versión (crm_guardar) para no pisar los cambios de otro admin. Tabla crm_datos,
// RLS es_admin() (doble factor). Ver supabase/migrations/20261006000000_crm.sql.
(function () {
  'use strict';

  var ESPERA_MS = 1200;          // agrupa ráfagas de cambios antes de guardar
  var MAX_VALOR = 8 * 1024 * 1024; // un PDF adjunto muy grande no debe colgar el guardado

  var versiones = {};   // clave → versión que tenemos (0 = no existe aún)
  var pendientes = {};  // clave → { valor, borrar } por guardar
  var enCurso = {};     // clave → true mientras hay una petición en vuelo
  var relojes = {};
  var conflicto = false;
  var pintarEstado = function () {};

  function hayPendientes() {
    return Object.keys(pendientes).length > 0 || Object.keys(enCurso).length > 0;
  }

  window.addEventListener('beforeunload', function (e) {
    if (hayPendientes()) { e.preventDefault(); e.returnValue = ''; }
  });

  function montar(cont, ctx) {
    var el = ctx.el;
    conflicto = false; // se recargan los datos actuales: un conflicto anterior ya no aplica
    var barra = el('div', 'crm-barra');
    var estado = el('span', 'crm-estado', 'Cargando…');
    var recargar = el('button', 'btn sec mini', 'Recargar CRM'); recargar.type = 'button'; recargar.style.display = 'none';
    barra.append(el('span', 'crm-titulo', 'CRM'), estado, recargar);
    var marco = el('iframe', 'crm-marco');
    marco.title = 'CRM de Candy Ads';
    // allow-scripts: el CRM es JavaScript. Sin allow-same-origin: origen opaco, aislado del panel.
    // allow-modals: confirm/alert/print. allow-popups(+escape): imprimir presupuestos, WhatsApp, mapas.
    // allow-downloads: exportar a Excel y la copia JSON. allow-forms: sus formularios.
    marco.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads');
    marco.setAttribute('referrerpolicy', 'no-referrer');
    // Portapapeles: los botones «Copiar» del CRM (informes, plantillas) lo necesitan dentro del marco.
    marco.setAttribute('allow', 'clipboard-write');
    marco.src = '/crm/index.html?v=1';
    cont.append(barra, marco);

    pintarEstado = function (txt, tipo) {
      if (!estado.isConnected) return;
      estado.textContent = txt;
      estado.className = 'crm-estado' + (tipo ? ' ' + tipo : '');
    };
    recargar.addEventListener('click', function () {
      if (hayPendientes() && !conflicto && !confirm('Hay cambios guardándose todavía. ¿Recargar igualmente?')) return;
      conflicto = false; pendientes = {}; recargar.style.display = 'none';
      marco.src = '/crm/index.html?v=1&r=' + Date.now();
    });

    var puerto = null;
    function alMensaje(e) {
      if (!marco.isConnected) { window.removeEventListener('message', alMensaje); return; }
      if (e.source !== marco.contentWindow || !e.data || e.data.tipo !== 'crm:listo') return;
      // Canal privado nuevo en cada carga del CRM.
      var canal = new MessageChannel();
      puerto = canal.port1;
      puerto.onmessage = function (ev) { recibir(ev.data || {}); };
      marco.contentWindow.postMessage({ tipo: 'crm:puerto' }, '*', [canal.port2]);
      cargarDatos();
    }
    window.addEventListener('message', alMensaje);

    function cargarDatos() {
      // Si se sale de la pestaña y se vuelve con guardados aún en marcha, primero se terminan: si no, el
      // CRM recién cargado mostraría datos de antes y su siguiente guardado chocaría con ellos.
      if (hayPendientes()) {
        pintarEstado('Terminando de guardar…');
        Object.keys(pendientes).forEach(function (k) { clearTimeout(relojes[k]); enviar(k); });
        setTimeout(cargarDatos, 400);
        return;
      }
      pintarEstado('Cargando datos…');
      ctx.api('/rest/v1/crm_datos?select=clave,valor,version')
        .then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('No se pudieron leer los datos del CRM.');
          return r.json();
        })
        .then(function (filas) {
          if (!filas) return;
          var datos = {};
          versiones = {};
          filas.forEach(function (f) { datos[f.clave] = f.valor; versiones[f.clave] = f.version; });
          puerto.postMessage({ tipo: 'init', datos: datos });
        })
        .catch(function (e) { pintarEstado(e.message, 'mal'); });
    }

    function recibir(m) {
      if (m.tipo === 'arrancado') { pintarEstado('Todo guardado', 'ok'); return; }
      if (conflicto) return;
      if (m.tipo === 'guardar' && typeof m.clave === 'string' && typeof m.valor === 'string') {
        if (m.valor.length > MAX_VALOR) { pintarEstado('Demasiado grande para guardar (máx. 8 MB por bloque). Quita algún PDF.', 'mal'); return; }
        programar(m.clave, { valor: m.valor });
      } else if (m.tipo === 'borrar' && typeof m.clave === 'string') {
        programar(m.clave, { borrar: true });
      }
    }

    function programar(clave, cambio) {
      pendientes[clave] = cambio;
      pintarEstado('Cambios sin guardar…');
      clearTimeout(relojes[clave]);
      relojes[clave] = setTimeout(function () { enviar(clave); }, ESPERA_MS);
    }

    function enviar(clave) {
      if (enCurso[clave] || !pendientes[clave] || conflicto) return;
      var cambio = pendientes[clave];
      delete pendientes[clave];
      enCurso[clave] = true;
      pintarEstado('Guardando…');
      var peticion = cambio.borrar
        ? ctx.api('/rest/v1/crm_datos?clave=eq.' + encodeURIComponent(clave), { method: 'DELETE' })
            .then(function (r) {
              if (r.status === 401) { ctx.sesionCaducada(); throw new Error('sesión'); }
              if (!r.ok) throw new Error('No se pudo borrar.');
              delete versiones[clave];
              return true;
            })
        : ctx.api('/rest/v1/rpc/crm_guardar', {
            method: 'POST',
            body: JSON.stringify({ p_clave: clave, p_valor: cambio.valor, p_version: versiones[clave] || 0 })
          }).then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); throw new Error('sesión'); }
            if (!r.ok) throw new Error('No se pudo guardar.');
            return r.json();
          }).then(function (v) {
            if (v === -1) return false;
            versiones[clave] = v;
            return true;
          });
      peticion.then(function (ok) {
        delete enCurso[clave];
        if (!ok) {
          conflicto = true;
          pendientes = {};
          pintarEstado('Otro miembro del equipo ha guardado cambios en el CRM mientras lo tenías abierto. ' +
            'Para no pisarlos, este último cambio no se ha guardado: recarga el CRM para ver la versión actual.', 'mal');
          recargar.style.display = '';
          return;
        }
        if (pendientes[clave]) enviar(clave);
        else if (!hayPendientes()) pintarEstado('Todo guardado', 'ok');
      }).catch(function (e) {
        delete enCurso[clave];
        if (e.message === 'sesión') return;
        // Se vuelve a poner en cola (si no llegó otro cambio más nuevo) y se reintenta.
        if (!pendientes[clave]) pendientes[clave] = cambio;
        pintarEstado(e.message + ' Reintentando…', 'mal');
        relojes[clave] = setTimeout(function () { enviar(clave); }, 5000);
      });
    }
  }

  window.PanelCore.registrar({ id: 'crm', titulo: 'CRM', ancho: true, montar: montar });
})();
