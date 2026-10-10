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
    marco.src = '/crm/index.html?v=8';
    cont.append(barra, marco);

    pintarEstado = function (txt, tipo) {
      if (!estado.isConnected) return;
      estado.textContent = txt;
      estado.className = 'crm-estado' + (tipo ? ' ' + tipo : '');
    };
    recargar.addEventListener('click', function () {
      if (hayPendientes() && !conflicto && !confirm('Hay cambios guardándose todavía. ¿Recargar igualmente?')) return;
      conflicto = false; pendientes = {}; recargar.style.display = 'none';
      marco.src = '/crm/index.html?v=8&r=' + Date.now();
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

    // ---------- Peticiones del CRM (vía CRM_PUENTE en puente.js) ----------
    // El CRM no tiene red: lo que necesita de Supabase se lo da el panel, que valida todo lo que recibe.

    function responder(tipo, datos) { if (puerto) puerto.postMessage({ tipo: tipo, datos: datos }); }
    function entero(v) { return Number.isInteger(v) && v > 0 ? v : null; }
    function json(r) {
      if (r.status === 401) { ctx.sesionCaducada(); throw new Error('sesión'); }
      if (!r.ok) throw new Error('No se pudieron leer los datos.');
      return r.json();
    }
    function texto(v, max) { var s = v == null ? '' : String(v).trim(); return s ? s.slice(0, max || 120) : null; }

    // Leads y ventas de todas las campañas asociadas a un cliente del CRM (solo cifras, ningún dato de leads).
    function trazabilidad(d) {
      var id = entero(d.clienteId);
      if (!id) return;
      ctx.api('/rest/v1/anunciantes_destino?select=slug,nombre_mostrado,estado&crm_cliente_id=eq.' + id + '&order=nombre_mostrado.asc')
        .then(json)
        .then(function (camps) {
          if (!camps.length) { responder('trazabilidad', { clienteId: id, campanas: [], meses: [] }); return; }
          // Los slugs ya vienen validados por la base de datos (solo [a-z0-9-]).
          var lista = camps.map(function (c) { return c.slug; }).join(',');
          return Promise.all([
            ctx.api('/rest/v1/leads_count?select=anunciante_slug,fecha,total&anunciante_slug=in.(' + lista + ')&limit=20000').then(json),
            ctx.api('/rest/v1/leads_registro?select=anunciante_slug,conversion,recibido_at&anunciante_slug=in.(' + lista + ')&limit=50000').then(json)
          ]).then(function (rs) { responder('trazabilidad', resumir(id, camps, rs[0], rs[1])); });
        })
        .catch(function (e) {
          if (e.message !== 'sesión') responder('trazabilidad', { clienteId: id, error: 'No se pudieron leer los datos de sus campañas.' });
        });
    }

    function resumir(id, camps, conteos, registros) {
      var hoy = new Date(), meses = [], idx = {};
      for (var i = 11; i >= 0; i--) {
        var m = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        var k = m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
        idx[k] = meses.length;
        meses.push({ mes: k, leads: 0, ventas: 0 });
      }
      var porSlug = {};
      camps.forEach(function (c) {
        porSlug[c.slug] = { slug: c.slug, nombre: c.nombre_mostrado || c.slug, estado: c.estado, leads: 0, ventas: 0, sinVenta: 0, pendientes: 0 };
      });
      conteos.forEach(function (r) {
        var c = porSlug[r.anunciante_slug];
        if (c) c.leads += r.total;
        var k = String(r.fecha).slice(0, 7);
        if (k in idx) meses[idx[k]].leads += r.total;
      });
      registros.forEach(function (r) {
        var c = porSlug[r.anunciante_slug];
        if (!c) return;
        if (r.conversion === 'venta') {
          c.ventas++;
          var k = String(r.recibido_at).slice(0, 7);
          if (k in idx) meses[idx[k]].ventas++;
        } else if (r.conversion === 'sin_venta') c.sinVenta++;
        else c.pendientes++;
      });
      return { clienteId: id, campanas: camps.map(function (c) { return porSlug[c.slug]; }), meses: meses };
    }

    function slugify(t) {
      var s = (t || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55);
      return s.replace(/-+$/, '');
    }

    // Presupuesto aceptado en el CRM → campaña en borrador con los datos del cliente. Se confirma aquí, en
    // el panel (no en el marco del CRM), mostrando a qué email llegarán los leads.
    function crearCampana(d) {
      var id = entero(d.clienteId), c = d.cliente || {}, ref = texto(d.ref, 40) || '';
      function fallo(msg) { responder('campana-error', { ref: ref, clienteId: id, mensaje: msg }); }
      if (!id || !texto(c.nombre)) { fallo('Faltan datos del cliente.'); return; }
      var email = texto(c.email, 200) || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        fallo('El cliente no tiene un email válido. Añádelo en su ficha del CRM (es donde llegarán los leads) y vuelve a pulsar.');
        return;
      }
      ctx.api('/rest/v1/anunciantes_destino?select=slug,crm_cliente_id').then(json).then(function (todas) {
        var suyas = todas.filter(function (x) { return x.crm_cliente_id === id; }).length;
        if (!confirm('Presupuesto ' + ref + ' aceptado por «' + texto(c.nombre) + '».\n\n¿Crear su campaña?\n\n' +
          '• Nace en BORRADOR: el QR no recibirá contactos hasta que la lances.\n' +
          '• Los leads llegarán a: ' + email + '\n' +
          (suyas ? '• Ojo: este cliente ya tiene ' + suyas + ' campaña(s).\n' : '') +
          '\nDespués revisa en su ficha el logo, los datos legales y los campos del formulario.')) {
          fallo('cancelado');
          return;
        }
        var usados = {};
        todas.forEach(function (x) { usados[x.slug] = true; });
        var base = slugify(c.nombre) || 'campana', slug = base, n = 2;
        while (usados[slug]) { slug = base + '-' + n; n++; }
        var CF = window.CandyFormulario;
        var fila = {
          slug: slug, nombre_mostrado: texto(c.nombre), estado: 'borrador', email_destino: email, limite_diario: 100,
          cif: texto(c.cif, 20), sector: texto(c.sector), zona: texto([c.municipio, c.provincia].filter(Boolean).join(', ')),
          crm_cliente_id: id, campos_formulario: CF.COMUNES.map(CF.copia), campos: ['nombre', 'telefono', 'email']
        };
        return ctx.api('/rest/v1/anunciantes_destino', {
          method: 'POST', body: JSON.stringify(fila), headers: { Prefer: 'return=representation' }
        }).then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); throw new Error('sesión'); }
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) { throw new Error((b && b.message) || 'No se pudo crear la campaña.'); });
          responder('campana-creada', { ref: ref, clienteId: id, slug: slug });
        });
      }).catch(function (e) { if (e.message !== 'sesión') fallo(e.message); });
    }

    function recibir(m) {
      if (m.tipo === 'arrancado') { pintarEstado('Todo guardado', 'ok'); return; }
      if (m.tipo === 'pedir-trazabilidad') { trazabilidad(m.datos || {}); return; }
      if (m.tipo === 'crear-campana') { crearCampana(m.datos || {}); return; }
      if (m.tipo === 'abrir-campana') {
        var s = (m.datos || {}).slug;
        if (typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,60}$/.test(s)) ctx.irA('campanas', s);
        return;
      }
      if (m.tipo === 'abrir-preventa') { ctx.irA('preventa'); return; }
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
