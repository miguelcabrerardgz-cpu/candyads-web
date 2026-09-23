// Herramienta: gestión de campañas de anunciantes. Sustituye a la antigua pestaña "Trazabilidad" (su
// lógica de detalle por día se reutiliza aquí, filtrada por campaña, dentro del bloque "Trazabilidad").
(function () {
  'use strict';

  var ESTADOS = {
    activa: { etiqueta: 'Activa', clase: 'badge-activa' },
    pausada: { etiqueta: 'Pausada', clase: 'badge-pausada' },
    finalizada: { etiqueta: 'Finalizada', clase: 'badge-finalizada' }
  };

  // Mismos campos que conoce el formulario público (CATALOGO en lead.js). Si se añade uno nuevo allí,
  // añadirlo también aquí para poder activarlo desde la ficha de campaña.
  var CAMPOS_DISPONIBLES = [
    ['nombre', 'Nombre'],
    ['telefono', 'Teléfono'],
    ['email', 'Email'],
    ['interes_venta_alquiler', '¿Qué necesitas? (venta/alquiler)'],
    ['mensaje', 'Mensaje']
  ];

  var TIPOS_ARCHIVO = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  var MAX_ARCHIVO = 15 * 1024 * 1024;

  var hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var diaMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
  var ETQ = { enviado: 'Enviado', error: 'Error de envío', pendiente: 'Sin confirmar' };
  var CONV = { pendiente: '—', venta: '✅ Venta', sin_venta: '❌ Sin venta' };

  function sumaDias(f, n) {
    var d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function slugify(texto) {
    var s = (texto || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 61);
    return s.replace(/-+$/, '');
  }

  function montar(cont, ctx) {
    var el = ctx.el, ymd = ctx.ymd;

    function limpiar() { ctx.clear(cont); }

    // ---------- Lista ----------

    function cargarLista() {
      limpiar();
      cont.appendChild(el('p', 'lead', 'Cargando…'));
      var hoy = new Date();
      var inicioMes = ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
      Promise.all([
        ctx.api('/rest/v1/anunciantes_destino?select=slug,estado,nombre_mostrado&order=nombre_mostrado.asc.nullslast,slug.asc'),
        ctx.api('/rest/v1/leads_count?select=anunciante_slug,total&fecha=gte.' + inicioMes + '&limit=5000'),
        ctx.api('/rest/v1/leads_registro?select=anunciante_slug,conversion&conversion=neq.pendiente&limit=5000')
      ]).then(function (rs) {
        if (rs.some(function (r) { return r.status === 401; })) { ctx.sesionCaducada(); return null; }
        if (rs.some(function (r) { return !r.ok; })) throw new Error('No se pudieron leer los datos.');
        return Promise.all(rs.map(function (r) { return r.json(); }));
      }).then(function (data) {
        if (!data) return;
        var anunciantes = data[0], leadsRows = data[1], convRows = data[2];
        var leadsPorMes = {};
        leadsRows.forEach(function (r) { leadsPorMes[r.anunciante_slug] = (leadsPorMes[r.anunciante_slug] || 0) + r.total; });
        var conversionPorSlug = {};
        convRows.forEach(function (r) {
          var c = conversionPorSlug[r.anunciante_slug] || (conversionPorSlug[r.anunciante_slug] = { venta: 0, total: 0 });
          c.total += 1;
          if (r.conversion === 'venta') c.venta += 1;
        });
        pintarLista(anunciantes, leadsPorMes, conversionPorSlug);
      }).catch(function (e) { limpiar(); cont.appendChild(el('div', 'p-err', e.message)); });
    }

    function pintarLista(anunciantes, leadsPorMes, conversionPorSlug) {
      limpiar();
      var head = el('div', 'p-head');
      head.appendChild(el('h1', 'p-h1', 'Campañas'));
      var nueva = el('button', 'btn', '+ Nueva campaña'); nueva.type = 'button';
      nueva.addEventListener('click', pintarAlta);
      head.appendChild(nueva);
      cont.appendChild(head);

      if (!anunciantes.length) {
        cont.appendChild(el('p', 'lead', 'Todavía no hay campañas. Da de alta la primera.'));
        return;
      }

      var t = el('table', 'p'), cabecera = el('tr');
      ['Campaña', 'Estado', 'Leads este mes', 'Conversión'].forEach(function (h) { cabecera.appendChild(el('th', null, h)); });
      t.appendChild(cabecera);
      anunciantes.forEach(function (a) {
        var tr = el('tr'); tr.className = 'clic';
        tr.addEventListener('click', function () { abrirDetalle(a.slug); });
        tr.appendChild(el('td', null, a.nombre_mostrado || a.slug));
        var tdEstado = el('td');
        var info = ESTADOS[a.estado] || { etiqueta: a.estado, clase: '' };
        tdEstado.appendChild(el('span', 'badge ' + info.clase, info.etiqueta));
        tr.appendChild(tdEstado);
        tr.appendChild(el('td', 'n', String(leadsPorMes[a.slug] || 0)));
        var conv = conversionPorSlug[a.slug];
        tr.appendChild(el('td', 'n', conv && conv.total ? Math.round(conv.venta / conv.total * 100) + '%' : '—'));
        t.appendChild(tr);
      });
      var w = el('div', 'tbl-scroll'); w.appendChild(t);
      cont.appendChild(w);
      cont.appendChild(el('p', 'p-note', 'Pulsa una campaña para ver y editar su ficha completa.'));
    }

    // ---------- Campos compartidos ----------

    function campoTexto(etiqueta, tipo) {
      var f = el('div', 'field');
      f.appendChild(el('label', 'lbl', etiqueta));
      var i = el('input'); i.type = tipo || 'text';
      f.appendChild(i);
      return { wrap: f, input: i };
    }

    function valOrNull(input) { var v = input.value.trim(); return v === '' ? null : v; }

    // ---------- Alta ----------

    function pintarAlta() {
      limpiar();
      var head = el('div', 'p-head');
      var volver = el('button', 'link', '← Campañas'); volver.type = 'button';
      volver.addEventListener('click', cargarLista);
      head.appendChild(volver);
      cont.appendChild(head);
      cont.appendChild(el('h1', 'p-h1', 'Nueva campaña'));

      var form = el('form');
      var err = el('div', 'p-err'); err.style.display = 'none';

      var fNombre = el('div', 'field');
      fNombre.appendChild(el('label', 'lbl', 'Nombre del anunciante'));
      var iNombre = el('input'); iNombre.type = 'text'; iNombre.required = true; iNombre.maxLength = 120;
      fNombre.appendChild(iNombre);

      var fSlug = el('div', 'field');
      fSlug.appendChild(el('label', 'lbl', 'Identificador (slug, para el enlace del QR)'));
      var iSlug = el('input'); iSlug.type = 'text'; iSlug.required = true; iSlug.autocomplete = 'off'; iSlug.spellcheck = false;
      fSlug.appendChild(iSlug);
      var slugTocado = false;
      iSlug.addEventListener('input', function () { slugTocado = true; });
      iNombre.addEventListener('input', function () { if (!slugTocado) iSlug.value = slugify(iNombre.value); });

      var razon = campoTexto('Razón social', 'text');
      var cif = campoTexto('CIF/NIF', 'text');
      var emailPriv = campoTexto('Email de privacidad (para el aviso legal del formulario)', 'email');
      var sector = campoTexto('Sector', 'text');
      var zona = campoTexto('Zona', 'text');

      var fEmailDestino = el('div', 'field');
      fEmailDestino.appendChild(el('label', 'lbl', 'Email donde llegan los leads'));
      var iEmailDestino = el('input'); iEmailDestino.type = 'email'; iEmailDestino.required = true;
      fEmailDestino.appendChild(iEmailDestino);

      var fLimite = el('div', 'field');
      fLimite.appendChild(el('label', 'lbl', 'Límite de leads al día'));
      var iLimite = el('input'); iLimite.type = 'number'; iLimite.min = 1; iLimite.max = 10000; iLimite.value = 100;
      fLimite.appendChild(iLimite);

      var color = campoTexto('Color principal del tema (hex, opcional)', 'text');
      color.input.placeholder = '#1C4C98';

      var fCampos = el('div', 'field');
      fCampos.appendChild(el('label', 'lbl', 'Campos del formulario público'));
      var casillas = {};
      CAMPOS_DISPONIBLES.forEach(function (c) {
        var w = el('label', 'check');
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = c[0] !== 'interes_venta_alquiler';
        casillas[c[0]] = cb;
        w.appendChild(cb);
        w.appendChild(document.createTextNode(c[1]));
        fCampos.appendChild(w);
      });

      var guardar = el('button', 'btn', 'Crear campaña'); guardar.type = 'submit';
      form.append(err, fNombre, fSlug, fEmailDestino, fLimite, razon.wrap, cif.wrap, emailPriv.wrap,
        sector.wrap, zona.wrap, color.wrap, fCampos, guardar);
      cont.appendChild(form);

      function mostrarError(m) { err.textContent = m; err.style.display = 'block'; }

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        err.style.display = 'none';
        var slug = iSlug.value.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug)) {
          mostrarError('El identificador solo puede tener minúsculas, números y guiones, y no puede empezar por guion.');
          return;
        }
        var colorHex = valOrNull(color.input);
        if (colorHex && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
          mostrarError('El color debe tener el formato #RRGGBB.');
          return;
        }
        var payload = {
          slug: slug,
          nombre_mostrado: iNombre.value.trim(),
          estado: 'activa',
          email_destino: iEmailDestino.value.trim(),
          limite_diario: parseInt(iLimite.value, 10) || 100,
          razon_social: valOrNull(razon.input),
          cif: valOrNull(cif.input),
          email_privacidad: valOrNull(emailPriv.input),
          sector: valOrNull(sector.input),
          zona: valOrNull(zona.input),
          tema_color: colorHex,
          campos: CAMPOS_DISPONIBLES.map(function (c) { return c[0]; }).filter(function (k) { return casillas[k].checked; })
        };
        guardar.disabled = true;
        ctx.api('/rest/v1/anunciantes_destino', { method: 'POST', body: JSON.stringify(payload) })
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return null; }
            if (r.status === 409) throw new Error('Ese identificador ya existe. Prueba con otro.');
            if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
              throw new Error((b && b.message) || 'No se pudo crear la campaña.');
            });
            return true;
          })
          .then(function (ok) { if (ok) pintarCreada(slug, payload.nombre_mostrado); })
          .catch(function (e) { mostrarError(e.message); guardar.disabled = false; });
      });
    }

    function pintarCreada(slug, nombre) {
      limpiar();
      var c = el('div', 'p-confirmacion');
      cont.appendChild(c);
      c.appendChild(el('h1', 'p-h1', 'Campaña creada'));
      c.appendChild(el('p', 'lead', '«' + nombre + '» ya está lista. Genera su QR o vuelve al listado.'));
      var qrBtn = el('button', 'btn', 'Generar su QR'); qrBtn.type = 'button';
      qrBtn.addEventListener('click', function () { ctx.irA('qr', slug); });
      var volver = el('button', 'btn sec', 'Volver a la lista'); volver.type = 'button';
      volver.addEventListener('click', cargarLista);
      c.append(qrBtn, volver);
    }

    // ---------- Detalle ----------

    function abrirDetalle(slug) {
      limpiar();
      cont.appendChild(el('p', 'lead', 'Cargando…'));
      ctx.api('/rest/v1/anunciantes_destino?select=*&slug=eq.' + encodeURIComponent(slug))
        .then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('No se pudo leer la campaña.');
          return r.json();
        })
        .then(function (rows) {
          if (!rows) return;
          if (!rows.length) { limpiar(); cont.appendChild(el('div', 'p-err', 'Esa campaña ya no existe.')); return; }
          pintarDetalle(rows[0]);
        })
        .catch(function (e) { limpiar(); cont.appendChild(el('div', 'p-err', e.message)); });
    }

    function pintarDetalle(a) {
      limpiar();
      var head = el('div', 'p-head');
      var volver = el('button', 'link', '← Campañas'); volver.type = 'button';
      volver.addEventListener('click', cargarLista);
      head.appendChild(volver);
      cont.appendChild(head);
      cont.appendChild(el('h1', 'p-h1', a.nombre_mostrado || a.slug));

      cont.appendChild(bloqueEstado(a));
      cont.appendChild(bloqueFicha(a));
      cont.appendChild(bloqueTrazabilidad(a));
      cont.appendChild(bloqueArchivos(a));
    }

    // 3.2 — Estado: separado de la ficha porque es la acción más urgente (dar de baja un QR ya impreso
    // no debería esperar a rellenar el resto del formulario).
    function bloqueEstado(a) {
      var sec = el('section', 'p-bloque');
      sec.appendChild(el('h2', 'p', 'Estado'));
      var fila = el('div', 'field');
      var select = el('select');
      Object.keys(ESTADOS).forEach(function (k) {
        var op = el('option', null, ESTADOS[k].etiqueta); op.value = k;
        select.appendChild(op);
      });
      select.value = a.estado;
      fila.appendChild(select);
      var guardar = el('button', 'btn', 'Guardar estado'); guardar.type = 'button';
      var msg = el('p', 'p-note');
      var aviso = el('p', 'p-note',
        'Mientras no esté "Activa", /lead/' + a.slug + ' mostrará un aviso de no disponible en vez del formulario.');

      guardar.addEventListener('click', function () {
        guardar.disabled = true;
        msg.className = 'p-note'; msg.textContent = '';
        ctx.api('/rest/v1/anunciantes_destino?slug=eq.' + encodeURIComponent(a.slug), {
          method: 'PATCH', body: JSON.stringify({ estado: select.value })
        }).then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return; }
          if (!r.ok) throw new Error('No se pudo guardar el estado.');
          a.estado = select.value;
          msg.textContent = 'Guardado.';
          guardar.disabled = false;
        }).catch(function (e) {
          msg.className = 'p-err'; msg.textContent = e.message;
          guardar.disabled = false;
        });
      });

      sec.append(fila, guardar, msg, aviso);
      return sec;
    }

    // 3.1 — Ficha: el resto de los datos de la campaña, editables aquí. Cambiar email_destino queda
    // auditado automáticamente (trigger en Supabase), sin nada que hacer desde este archivo.
    function bloqueFicha(a) {
      var sec = el('section', 'p-bloque');
      sec.appendChild(el('h2', 'p', 'Ficha'));
      var form = el('form');
      var err = el('div', 'p-err'); err.style.display = 'none';

      var nombre = campoTexto('Nombre del anunciante', 'text'); nombre.input.required = true; nombre.input.value = a.nombre_mostrado || '';
      var emailDestino = campoTexto('Email donde llegan los leads', 'email'); emailDestino.input.required = true; emailDestino.input.value = a.email_destino || '';
      var fLimite = el('div', 'field');
      fLimite.appendChild(el('label', 'lbl', 'Límite de leads al día'));
      var iLimite = el('input'); iLimite.type = 'number'; iLimite.min = 1; iLimite.max = 10000; iLimite.value = a.limite_diario || 100;
      fLimite.appendChild(iLimite);
      var razon = campoTexto('Razón social', 'text'); razon.input.value = a.razon_social || '';
      var cif = campoTexto('CIF/NIF', 'text'); cif.input.value = a.cif || '';
      var emailPriv = campoTexto('Email de privacidad', 'email'); emailPriv.input.value = a.email_privacidad || '';
      var sector = campoTexto('Sector', 'text'); sector.input.value = a.sector || '';
      var zona = campoTexto('Zona', 'text'); zona.input.value = a.zona || '';
      var color = campoTexto('Color principal del tema (hex)', 'text'); color.input.value = a.tema_color || ''; color.input.placeholder = '#1C4C98';
      var colorSec = campoTexto('Color secundario del tema (hex)', 'text'); colorSec.input.value = a.tema_color_secundario || '';
      var logo = campoTexto('Logo (ruta en el repo, ej. /assets/anunciantes/' + a.slug + '.png)', 'text'); logo.input.value = a.tema_logo || '';

      var fCampos = el('div', 'field');
      fCampos.appendChild(el('label', 'lbl', 'Campos del formulario público'));
      var casillas = {};
      var actuales = Array.isArray(a.campos) ? a.campos : [];
      CAMPOS_DISPONIBLES.forEach(function (c) {
        var w = el('label', 'check');
        var cb = el('input'); cb.type = 'checkbox'; cb.checked = actuales.indexOf(c[0]) !== -1;
        casillas[c[0]] = cb;
        w.appendChild(cb);
        w.appendChild(document.createTextNode(c[1]));
        fCampos.appendChild(w);
      });

      var guardar = el('button', 'btn', 'Guardar ficha'); guardar.type = 'submit';
      form.append(err, nombre.wrap, emailDestino.wrap, fLimite, razon.wrap, cif.wrap, emailPriv.wrap,
        sector.wrap, zona.wrap, color.wrap, colorSec.wrap, logo.wrap, fCampos, guardar);
      sec.appendChild(form);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        err.style.display = 'none';
        var colorHex = valOrNull(color.input), colorSecHex = valOrNull(colorSec.input);
        if (colorHex && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
          err.textContent = 'El color principal debe tener el formato #RRGGBB.'; err.style.display = 'block'; return;
        }
        if (colorSecHex && !/^#[0-9a-fA-F]{6}$/.test(colorSecHex)) {
          err.textContent = 'El color secundario debe tener el formato #RRGGBB.'; err.style.display = 'block'; return;
        }
        var logoVal = valOrNull(logo.input);
        if (logoVal && !/^\/assets\/anunciantes\/[a-z0-9._-]+\.(png|svg|jpg|jpeg|webp)$/i.test(logoVal)) {
          err.textContent = 'El logo debe ser una ruta como /assets/anunciantes/archivo.png.'; err.style.display = 'block'; return;
        }
        var payload = {
          nombre_mostrado: nombre.input.value.trim(),
          email_destino: emailDestino.input.value.trim(),
          limite_diario: parseInt(iLimite.value, 10) || 100,
          razon_social: valOrNull(razon.input),
          cif: valOrNull(cif.input),
          email_privacidad: valOrNull(emailPriv.input),
          sector: valOrNull(sector.input),
          zona: valOrNull(zona.input),
          tema_color: colorHex,
          tema_color_secundario: colorSecHex,
          tema_logo: logoVal,
          campos: CAMPOS_DISPONIBLES.map(function (c) { return c[0]; }).filter(function (k) { return casillas[k].checked; })
        };
        guardar.disabled = true;
        ctx.api('/rest/v1/anunciantes_destino?slug=eq.' + encodeURIComponent(a.slug), { method: 'PATCH', body: JSON.stringify(payload) })
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return; }
            if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
              throw new Error((b && b.message) || 'No se pudo guardar la ficha.');
            });
            Object.assign(a, payload);
            guardar.disabled = false;
          })
          .catch(function (e) { err.textContent = e.message; err.style.display = 'block'; guardar.disabled = false; });
      });
      return sec;
    }

    // 3.3 — Trazabilidad de esta campaña (misma lógica que la antigua pestaña "Trazabilidad", filtrada).
    function bloqueTrazabilidad(a) {
      var sec = el('section', 'p-bloque');
      sec.appendChild(el('h2', 'p', 'Trazabilidad'));
      var sub = el('div');
      sec.appendChild(sub);
      var resumenFilas = [];

      function limpiarSub() { ctx.clear(sub); }

      function cargarResumen() {
        limpiarSub();
        sub.appendChild(el('p', 'lead', 'Cargando…'));
        var desde = new Date(); desde.setDate(desde.getDate() - 400);
        ctx.api('/rest/v1/leads_count?select=fecha,total&anunciante_slug=eq.' + encodeURIComponent(a.slug) +
            '&fecha=gte.' + ymd(desde) + '&order=fecha.desc&limit=1000')
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return null; }
            if (!r.ok) throw new Error('No se pudieron leer los datos.');
            return r.json();
          })
          .then(function (rows) { if (rows) { resumenFilas = rows; pintarResumen(rows); } })
          .catch(function (e) { limpiarSub(); sub.appendChild(el('div', 'p-err', e.message)); });
      }

      function pintarResumen(rows) {
        limpiarSub();
        if (!rows.length) { sub.appendChild(el('p', 'lead', 'Sin leads todavía.')); return; }
        var hoy = new Date(), mes = ymd(hoy).slice(0, 7);
        var mesAnt = ymd(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)).slice(0, 7);
        var c = { hoy: 0, mes: 0, ant: 0, tot: 0 };
        rows.forEach(function (r) {
          if (r.fecha === ymd(hoy)) c.hoy += r.total;
          if (r.fecha.slice(0, 7) === mes) c.mes += r.total;
          if (r.fecha.slice(0, 7) === mesAnt) c.ant += r.total;
          c.tot += r.total;
        });
        sub.appendChild(el('p', 'p-cifras', c.hoy + ' hoy · ' + c.mes + ' este mes · ' + c.ant + ' mes anterior · ' + c.tot + ' en 13 meses'));
        var w = ctx.tabla(['Fecha', 'Leads'], rows.slice(0, 30).map(function (r) { return [r.fecha, r.total]; }));
        Array.prototype.forEach.call(w.querySelectorAll('tr'), function (tr, i) {
          if (i === 0) return;
          tr.className = 'clic';
          tr.addEventListener('click', function () { verDia(rows[i - 1].fecha); });
        });
        sub.appendChild(w);
        var ir = el('button', 'btn sec', 'Ver el día de hoy'); ir.type = 'button';
        ir.addEventListener('click', function () { verDia(ymd(new Date())); });
        sub.appendChild(ir);
      }

      function verDia(fecha) {
        ctx.api('/rest/v1/leads_registro?select=ref,recibido_at,estado,conversion&anunciante_slug=eq.' + encodeURIComponent(a.slug) +
            '&recibido_at=gte.' + sumaDias(fecha, -1) + 'T00:00:00Z&recibido_at=lt.' + sumaDias(fecha, 2) + 'T00:00:00Z&order=recibido_at.asc&limit=500')
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return null; }
            if (!r.ok) throw new Error('No se pudieron leer los leads.');
            return r.json();
          })
          .then(function (rows) {
            if (!rows) return;
            pintarDia(fecha, rows.filter(function (r) { return diaMadrid.format(new Date(r.recibido_at)) === fecha; }));
          })
          .catch(function (e) { limpiarSub(); sub.appendChild(el('div', 'p-err', e.message)); });
      }

      function pintarDia(fecha, rows) {
        limpiarSub();
        var volver = el('button', 'link', '← Resumen'); volver.type = 'button';
        volver.addEventListener('click', function () { pintarResumen(resumenFilas); });
        sub.appendChild(volver);
        var nav = el('div', 'p-nav');
        var ant = el('button', 'btn nav', '‹'), sig = el('button', 'btn nav', '›');
        var inp = el('input'); inp.type = 'date'; inp.value = fecha;
        ant.addEventListener('click', function () { verDia(sumaDias(fecha, -1)); });
        sig.addEventListener('click', function () { verDia(sumaDias(fecha, 1)); });
        inp.addEventListener('change', function () { if (inp.value) verDia(inp.value); });
        nav.append(ant, inp, sig);
        sub.appendChild(nav);

        var c = { enviado: 0, error: 0, pendiente: 0 };
        var conv = { pendiente: 0, venta: 0, sin_venta: 0 };
        rows.forEach(function (r) { c[r.estado] += 1; conv[r.conversion] += 1; });
        sub.appendChild(el('p', 'p-cifras',
          c.enviado + ' enviados' + (c.error ? ' · ' + c.error + ' con error' : '') + (c.pendiente ? ' · ' + c.pendiente + ' sin confirmar' : '') +
          (conv.venta || conv.sin_venta ? ' · ' + conv.venta + ' venta / ' + conv.sin_venta + ' sin venta' : '')));
        if (!rows.length) { sub.appendChild(el('p', 'lead', 'Sin leads este día.')); return; }
        sub.appendChild(ctx.tabla(['Hora', 'Ref.', 'Estado', 'Conversión'],
          rows.map(function (r) { return [hora.format(new Date(r.recibido_at)), r.ref.slice(0, 8).toUpperCase(), ETQ[r.estado], CONV[r.conversion]]; })));
      }

      cargarResumen();
      return sec;
    }

    // 3.4 — Archivos de la campaña contra el bucket privado creado en la Fase 1. Sin enlaces públicos:
    // la descarga siempre pasa por este panel (la RLS de storage.objects exige es_admin()).
    function bloqueArchivos(a) {
      var sec = el('section', 'p-bloque');
      sec.appendChild(el('h2', 'p', 'Archivos'));
      var errSub = el('div', 'p-err'); errSub.style.display = 'none';
      var inputFile = el('input'); inputFile.type = 'file'; inputFile.accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx';
      var subir = el('button', 'btn', 'Subir archivo'); subir.type = 'button';
      var nota = el('p', 'p-note', 'PDF, imágenes (PNG/JPG/WEBP) o Word, hasta 15 MB.');
      var lista = el('div');
      sec.append(errSub, inputFile, subir, nota, lista);

      function sanear(nombre) { return nombre.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120); }
      function nombreVisible(nombreGuardado) {
        var i = nombreGuardado.indexOf('__');
        return i === -1 ? nombreGuardado : nombreGuardado.slice(i + 2);
      }

      function cargarArchivos() {
        ctx.clear(lista);
        lista.appendChild(el('p', 'lead', 'Cargando…'));
        ctx.api('/storage/v1/object/list/campanas-archivos', {
          method: 'POST', body: JSON.stringify({ prefix: a.slug + '/', limit: 100, sortBy: { column: 'name', order: 'desc' } })
        }).then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('No se pudieron listar los archivos.');
          return r.json();
        }).then(function (items) { if (items) pintarArchivos(items); })
          .catch(function (e) { ctx.clear(lista); lista.appendChild(el('div', 'p-err', e.message)); });
      }

      function pintarArchivos(items) {
        ctx.clear(lista);
        if (!items.length) { lista.appendChild(el('p', 'lead', 'Todavía no hay archivos.')); return; }
        items.forEach(function (item) {
          var fila = el('div', 'archivo-fila');
          fila.appendChild(el('span', null, nombreVisible(item.name)));
          var bDesc = el('button', 'link', 'Descargar'); bDesc.type = 'button';
          bDesc.addEventListener('click', function () { descargarArchivo(item.name); });
          var bDel = el('button', 'link', 'Eliminar'); bDel.type = 'button';
          bDel.addEventListener('click', function () { eliminarArchivo(item.name); });
          fila.append(bDesc, bDel);
          lista.appendChild(fila);
        });
      }

      function descargarArchivo(nombreGuardado) {
        errSub.style.display = 'none';
        ctx.api('/storage/v1/object/campanas-archivos/' + a.slug + '/' + encodeURIComponent(nombreGuardado))
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return null; }
            if (!r.ok) throw new Error('No se pudo descargar.');
            return r.blob();
          })
          .then(function (blob) {
            if (!blob) return;
            var url = URL.createObjectURL(blob);
            var link = el('a'); link.href = url; link.download = nombreVisible(nombreGuardado);
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          })
          .catch(function (e) { errSub.textContent = e.message; errSub.style.display = 'block'; });
      }

      function eliminarArchivo(nombreGuardado) {
        if (!confirm('¿Eliminar «' + nombreVisible(nombreGuardado) + '»? No se puede deshacer.')) return;
        errSub.style.display = 'none';
        ctx.api('/storage/v1/object/campanas-archivos/' + a.slug + '/' + encodeURIComponent(nombreGuardado), { method: 'DELETE' })
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return; }
            if (!r.ok) throw new Error('No se pudo eliminar.');
            cargarArchivos();
          })
          .catch(function (e) { errSub.textContent = e.message; errSub.style.display = 'block'; });
      }

      subir.addEventListener('click', function () {
        errSub.style.display = 'none';
        var file = inputFile.files && inputFile.files[0];
        if (!file) { errSub.textContent = 'Elige un archivo primero.'; errSub.style.display = 'block'; return; }
        if (file.size > MAX_ARCHIVO) { errSub.textContent = 'El archivo pesa más de 15 MB.'; errSub.style.display = 'block'; return; }
        if (TIPOS_ARCHIVO.indexOf(file.type) === -1) { errSub.textContent = 'Tipo de archivo no admitido.'; errSub.style.display = 'block'; return; }
        var ruta = a.slug + '/' + Date.now() + '__' + sanear(file.name);
        subir.disabled = true;
        ctx.api('/storage/v1/object/campanas-archivos/' + ruta.split('/').map(encodeURIComponent).join('/'), {
          method: 'POST', body: file, contentType: file.type || 'application/octet-stream'
        }).then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return; }
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
            throw new Error((b && b.message) || 'No se pudo subir el archivo.');
          });
          inputFile.value = '';
          cargarArchivos();
        }).catch(function (e) { errSub.textContent = e.message; errSub.style.display = 'block'; })
          .then(function () { subir.disabled = false; });
      });

      cargarArchivos();
      return sec;
    }

    cargarLista();
  }

  PanelCore.registrar({ id: 'campanas', titulo: 'Campañas', montar: montar });
})();
