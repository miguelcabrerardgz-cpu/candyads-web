// Herramienta: gestión de campañas de anunciantes. Sustituye a la antigua pestaña "Trazabilidad" (su
// lógica de detalle por día se reutiliza aquí, filtrada por campaña, dentro del bloque "Trazabilidad").
(function () {
  'use strict';

  var ESTADOS = {
    borrador: { etiqueta: 'Borrador', clase: 'badge-borrador' },
    activa: { etiqueta: 'Activa', clase: 'badge-activa' },
    pausada: { etiqueta: 'Pausada', clase: 'badge-pausada' },
    finalizada: { etiqueta: 'Finalizada', clase: 'badge-finalizada' }
  };

  // Los campos del formulario público se definen y pintan con formulario.js (compartido con /lead/<slug>).

  var TIPOS_ARCHIVO = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  var MAX_ARCHIVO = 15 * 1024 * 1024;

  // Dirección que lleva el QR impreso. No se guarda en la base de datos: sale siempre del slug, que no se
  // puede cambiar desde el panel (no va en el PATCH de la ficha), así que es la misma el día del alta y meses
  // después. Mismo prefijo que BASE en qr.js.
  var BASE_LEAD = 'https://candyads.es/lead/';

  // Morado oficial de Candy Ads: color del formulario público cuando la campaña no tiene uno propio legible.
  // lead.js aplica la misma regla (mismo valor y mismo umbral) al pintar /lead/<slug>.
  var COLOR_MARCA = '#8B7BC0';
  var CONTRASTE_MIN = 3;

  // Contraste WCAG frente a blanco (el texto de los botones del formulario es blanco).
  function contrasteBlanco(hex) {
    var l = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 1.05 / (0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] + 0.05);
  }

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

  function montar(cont, ctx, param) {
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
      ['Campaña', 'Estado', 'Enlace del QR', 'Leads este mes', 'Conversión'].forEach(function (h, i) {
        cabecera.appendChild(el('th', i === 2 ? 'izq' : null, h));
      });
      t.appendChild(cabecera);
      anunciantes.forEach(function (a) {
        var tr = el('tr'); tr.className = 'clic';
        tr.addEventListener('click', function () { abrirDetalle(a.slug); });
        tr.appendChild(el('td', null, a.nombre_mostrado || a.slug));
        var tdEstado = el('td');
        var info = ESTADOS[a.estado] || { etiqueta: a.estado, clase: '' };
        tdEstado.appendChild(el('span', 'badge ' + info.clase, info.etiqueta));
        tr.appendChild(tdEstado);
        // Solo los QR vivos (activa/pausada): de un vistazo, qué enlaces hay ahora mismo en la calle.
        var tdEnlace = el('td', 'izq');
        if (a.estado === 'activa' || a.estado === 'pausada') tdEnlace.appendChild(enlaceQr(a.slug, true));
        else tdEnlace.textContent = '—';
        tr.appendChild(tdEnlace);
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

    // Clientes del CRM (crm_datos.ncrm_crm) para asociar la campaña. Solo se usan id y nombre; textContent.
    function cargarClientesCrm(sel, actual) {
      sel.disabled = true;
      sel.appendChild(el('option', null, 'Cargando clientes…'));
      ctx.api('/rest/v1/crm_datos?select=valor&clave=eq.ncrm_crm')
        .then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('crm');
          return r.json();
        })
        .then(function (filas) {
          if (!filas) return;
          var clientes = [];
          try { clientes = filas.length ? JSON.parse(filas[0].valor) : []; } catch (e) { clientes = []; }
          ctx.clear(sel);
          var o0 = el('option', null, '— Sin asociar —'); o0.value = ''; sel.appendChild(o0);
          clientes.filter(function (c) { return c && Number.isInteger(c.id) && c.nombre; })
            .sort(function (x, y) { return String(x.nombre).localeCompare(String(y.nombre), 'es'); })
            .forEach(function (c) { var o = el('option', null, c.nombre); o.value = String(c.id); sel.appendChild(o); });
          // Si estaba asociada a un cliente que ya no existe en el CRM, se mantiene visible.
          if (actual && !clientes.some(function (c) { return c && c.id === actual; })) {
            var oX = el('option', null, 'Cliente ' + actual + ' (ya no está en el CRM)'); oX.value = String(actual); sel.appendChild(oX);
          }
          sel.value = actual ? String(actual) : '';
          sel.disabled = false;
        })
        .catch(function () { ctx.clear(sel); sel.appendChild(el('option', null, 'No se pudieron leer los clientes del CRM')); });
    }

    // Historial del email de destino (campanas_cambios, lo rellena solo un trigger en Supabase: alta, cambios
    // y baja, con quién y cuándo). Solo lectura: el panel no puede escribir en esa tabla.
    var fechaHora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' });
    function historialEmail(a) {
      var w = el('div', 'historial-email');
      w.appendChild(el('p', 'lbl', 'Historial del email de destino'));
      var cuerpo = el('div');
      w.appendChild(cuerpo);
      function cargar() {
        ctx.clear(cuerpo);
        ctx.api('/rest/v1/campanas_cambios?select=campo,valor_anterior,valor_nuevo,admin_email,creado_at&anunciante_slug=eq.' +
            encodeURIComponent(a.slug) + '&order=creado_at.desc&limit=20')
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return null; }
            if (!r.ok) throw new Error('No se pudo leer el historial.');
            return r.json();
          })
          .then(function (filas) {
            if (!filas) return;
            if (!filas.length) { cuerpo.appendChild(el('p', 'p-note', 'Sin cambios registrados.')); return; }
            var t = el('table', 'p'), cab = el('tr');
            ['Cuándo', 'Qué', 'Quién'].forEach(function (h) { cab.appendChild(el('th', 'izq', h)); });
            t.appendChild(cab);
            filas.forEach(function (f) {
              var que = f.campo === 'alta' ? 'Alta con destino ' + f.valor_nuevo
                : f.campo === 'baja' ? 'Baja (destino ' + f.valor_anterior + ')'
                : f.valor_anterior + ' → ' + f.valor_nuevo;
              var tr = el('tr');
              [fechaHora.format(new Date(f.creado_at)), que, f.admin_email].forEach(function (v) { tr.appendChild(el('td', 'izq', v)); });
              t.appendChild(tr);
            });
            var s = el('div', 'tbl-scroll'); s.appendChild(t);
            cuerpo.appendChild(s);
          })
          .catch(function (e) { cuerpo.appendChild(el('div', 'p-err', e.message)); });
      }
      cargar();
      return { wrap: w, recargar: cargar };
    }

    // Editor de los campos del formulario público, con vista previa en vivo pintada por formulario.js (el
    // mismo que usa /lead/<slug>). Comunes: se quitan y se vuelven a añadir con un clic. Personalizados:
    // etiqueta + tipo + obligatorio (+ opciones si es desplegable); su clave sale de la etiqueta, sin repetir.
    function editorCampos(a) {
      var CF = window.CandyFormulario;
      var lista = CF.normalizar({ campos_formulario: a.campos_formulario, campos: a.campos });
      var wrap = el('div', 'field editor-campos');
      wrap.appendChild(el('label', 'lbl', 'Campos del formulario público'));
      var filas = el('div', 'ec-lista');
      var comunes = el('div', 'ec-comunes');
      var errEd = el('div', 'p-err'); errEd.style.display = 'none';

      var nuevo = el('div', 'ec-nuevo');
      nuevo.appendChild(el('p', 'lbl', 'Añadir un campo personalizado'));
      var iLabel = el('input'); iLabel.type = 'text'; iLabel.maxLength = 80; iLabel.placeholder = 'Pregunta, p. ej. ¿Cuántas habitaciones?';
      var sTipo = el('select');
      Object.keys(CF.TIPOS).forEach(function (k) { var o = el('option', null, CF.TIPOS[k]); o.value = k; sTipo.appendChild(o); });
      var iOpc = el('input'); iOpc.type = 'text'; iOpc.placeholder = 'Opciones separadas por comas'; iOpc.style.display = 'none';
      var lObl = el('label', 'check'); var cbObl = el('input'); cbObl.type = 'checkbox';
      lObl.append(cbObl, document.createTextNode('Obligatorio'));
      var bAdd = el('button', 'btn sec mini', 'Añadir campo'); bAdd.type = 'button';
      sTipo.addEventListener('change', function () { iOpc.style.display = sTipo.value === 'select' ? '' : 'none'; });
      var filaNuevo = el('div', 'ec-nuevo-fila');
      filaNuevo.append(iLabel, sTipo);
      nuevo.append(filaNuevo, iOpc, lObl, bAdd);

      var vista = el('div', 'ec-vista');

      function aviso(t) { errEd.textContent = t; errEd.style.display = t ? 'block' : 'none'; }

      function boton(txt, titulo, fn, desactivado) {
        var b = el('button', 'btn-icono ec-btn', txt); b.type = 'button'; b.title = titulo; b.setAttribute('aria-label', titulo);
        b.disabled = !!desactivado;
        b.addEventListener('click', fn);
        return b;
      }

      function pintar() {
        ctx.clear(filas); ctx.clear(comunes); ctx.clear(vista);
        lista.forEach(function (d, i) {
          var f = el('div', 'ec-fila');
          var nom = el('div', 'ec-nombre', d.label);
          nom.appendChild(el('span', 'ec-tipo', ' · ' + CF.TIPOS[d.tipo] + (d.tipo === 'select' ? ' (' + d.opciones.join(', ') + ')' : '')));
          var lo = el('label', 'check ec-obl'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = d.obligatorio;
          cb.addEventListener('change', function () { d.obligatorio = cb.checked; pintar(); });
          lo.append(cb, document.createTextNode('Obligatorio'));
          f.append(nom, lo,
            boton('↑', 'Subir', function () { lista.splice(i - 1, 0, lista.splice(i, 1)[0]); pintar(); }, i === 0),
            boton('↓', 'Bajar', function () { lista.splice(i + 1, 0, lista.splice(i, 1)[0]); pintar(); }, i === lista.length - 1),
            boton('✕', 'Quitar', function () { lista.splice(i, 1); pintar(); }));
          filas.appendChild(f);
        });
        var fuera = CF.COMUNES.filter(function (c) { return !lista.some(function (d) { return d.key === c.key; }); });
        if (fuera.length) {
          comunes.appendChild(el('span', 'p-note', 'Comunes desactivados: '));
          fuera.forEach(function (c) {
            var b = el('button', 'btn sec mini', '+ ' + c.label); b.type = 'button';
            b.addEventListener('click', function () { lista.push(CF.copia(c)); pintar(); });
            comunes.appendChild(b);
          });
        }
        vista.appendChild(el('p', 'lbl', 'Vista previa del formulario'));
        var f2 = el('form', 'ec-form'); f2.noValidate = true;
        f2.addEventListener('submit', function (ev) { ev.preventDefault(); });
        CF.pintar(f2, lista, null, 'pv-');
        var falso = el('button', 'btn', 'Enviar solicitud'); falso.type = 'button'; falso.disabled = true;
        f2.appendChild(falso);
        vista.appendChild(f2);
      }

      bAdd.addEventListener('click', function () {
        aviso('');
        var label = iLabel.value.trim();
        if (!label) { aviso('Escribe la pregunta del campo.'); return; }
        if (lista.length >= 25) { aviso('Máximo 25 campos.'); return; }
        var d = { key: CF.claveDe(label, lista.map(function (x) { return x.key; })), label: label, tipo: sTipo.value, obligatorio: cbObl.checked };
        if (d.tipo === 'select') {
          d.opciones = iOpc.value.split(',').map(function (o) { return o.trim(); }).filter(Boolean);
          if (!d.opciones.length) { aviso('Un desplegable necesita al menos una opción.'); return; }
        }
        lista.push(d);
        iLabel.value = ''; iOpc.value = ''; cbObl.checked = false;
        pintar();
      });

      pintar();
      wrap.append(filas, comunes, errEd, nuevo, vista);
      wrap.appendChild(el('p', 'p-note', 'Los cambios de campos se guardan con «Guardar ficha».'));
      return { wrap: wrap, valor: function () { return lista.map(CF.copia); } };
    }

    // Color: selector visual + hex editable, sincronizados. conContraste: además, contraste con blanco en vivo.
    function campoColor(etiqueta, valor, conContraste) {
      var f = el('div', 'field');
      f.appendChild(el('label', 'lbl', etiqueta));
      var fila = el('div', 'color-fila');
      var picker = el('input'); picker.type = 'color';
      var hex = el('input'); hex.type = 'text'; hex.placeholder = '#RRGGBB'; hex.value = valor || '';
      var info = el('p', 'p-note');
      function sync() {
        var v = hex.value.trim(), ok = /^#[0-9a-fA-F]{6}$/.test(v);
        if (ok) picker.value = v.toLowerCase();
        if (!conContraste) return;
        info.className = 'p-note';
        if (!v) { info.textContent = 'Sin color: el formulario usa el morado de Candy Ads.'; return; }
        if (!ok) { info.textContent = 'Formato #RRGGBB.'; return; }
        var c = contrasteBlanco(v), bien = c >= CONTRASTE_MIN;
        info.className = 'p-note ' + (bien ? 'color-ok' : 'color-mal');
        info.textContent = 'Contraste con el texto blanco: ' + c.toFixed(1).replace('.', ',') + ':1 ' +
          (bien ? '✓' : '✗ insuficiente (mínimo 3:1): el formulario usará el morado de Candy Ads.');
      }
      picker.addEventListener('input', function () { hex.value = picker.value.toUpperCase(); sync(); });
      hex.addEventListener('input', sync);
      fila.append(picker, hex);
      f.append(fila, info);
      sync();
      return { wrap: f, input: hex };
    }

    // Enlace del QR (seleccionable y clicable) + botón de copiar. compacto: versión corta del listado.
    function enlaceQr(slug, compacto) {
      var url = BASE_LEAD + slug;
      var etiqueta = compacto ? 'Copiar' : 'Copiar enlace';
      var w = el('div', 'enlace' + (compacto ? ' compacto' : ''));
      var a = el('a', null, compacto ? url.replace(/^https:\/\//, '') : url);
      a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = url;
      var b = el('button', 'btn sec mini', etiqueta); b.type = 'button';
      // En el listado la fila entera abre la ficha: estos dos clics no deben llegar a la fila.
      [a, b].forEach(function (n) { n.addEventListener('click', function (ev) { ev.stopPropagation(); }); });
      var reloj = null;
      function avisar(texto) {
        b.textContent = texto;
        clearTimeout(reloj);
        reloj = setTimeout(function () { b.textContent = etiqueta; }, 2000);
      }
      // Si el navegador no deja escribir en el portapapeles, se deja el texto seleccionado para Ctrl+C.
      function aMano() {
        var r = document.createRange(); r.selectNodeContents(a);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        avisar('Pulsa Ctrl+C');
      }
      b.addEventListener('click', function () {
        if (!navigator.clipboard) { aMano(); return; }
        navigator.clipboard.writeText(url).then(function () { avisar('Copiado ✓'); }, aMano);
      });
      w.append(a, b);
      return w;
    }

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

      // Campaña nueva: nace con los cinco campos comunes; se quitan, añaden o reordenan después en su ficha.
      var fCampos = el('p', 'p-note', 'El formulario público empezará con los campos comunes (nombre, apellidos, ' +
        'teléfono, email y código postal). Podrás quitarlos, añadir otros y ordenarlos en la ficha de la campaña.');

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
          // Nace en borrador: el QR no muestra el formulario hasta pulsar «Lanzar campaña» en su ficha.
          estado: 'borrador',
          email_destino: iEmailDestino.value.trim(),
          limite_diario: parseInt(iLimite.value, 10) || 100,
          razon_social: valOrNull(razon.input),
          cif: valOrNull(cif.input),
          email_privacidad: valOrNull(emailPriv.input),
          sector: valOrNull(sector.input),
          zona: valOrNull(zona.input),
          tema_color: colorHex,
          campos_formulario: window.CandyFormulario.COMUNES.map(window.CandyFormulario.copia),
          // Lista antigua de claves, solo por compatibilidad mientras quede algo que la lea.
          campos: ['nombre', 'telefono', 'email']
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
      c.appendChild(el('p', 'lead', '«' + nombre + '» está creada como borrador: su QR no mostrará el formulario hasta que pulses «Lanzar campaña» en su ficha. Ya puedes generar su QR.'));
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
      head.appendChild(botonEliminar(a));
      cont.appendChild(head);
      cont.appendChild(el('h1', 'p-h1', a.nombre_mostrado || a.slug));

      cont.appendChild(bloqueEnlace(a));
      cont.appendChild(bloqueEstado(a));
      cont.appendChild(bloqueFicha(a));
      cont.appendChild(bloqueTrazabilidad(a));
      cont.appendChild(bloqueArchivos(a));
    }

    function iconoPapelera() {
      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13');
      svg.appendChild(path);
      return svg;
    }

    // Borrado de la campaña: icono discreto en la cabecera, no un botón grande junto a las demás
    // acciones. Solo borra la ficha (anunciantes_destino) — los leads ya recibidos se quedan en la
    // base de datos (no hay borrado en cascada), pero dejan de verse desde el panel al no quedar
    // ninguna campaña a la que asociarlos; el popup de confirmación lo explica antes de que se pueda
    // pulsar "Aceptar" por error, y sugiere "Finalizada" como alternativa si no se quiere perder eso.
    function botonEliminar(a) {
      var btn = el('button', 'btn-icono peligro'); btn.type = 'button';
      btn.title = 'Eliminar campaña';
      btn.setAttribute('aria-label', 'Eliminar campaña');
      btn.appendChild(iconoPapelera());

      btn.addEventListener('click', function () {
        var nombre = a.nombre_mostrado || a.slug;
        var ok = confirm(
          '¿Eliminar la campaña «' + nombre + '»?\n\n' +
          'Se borra su ficha (nombre, contactos, tema, campos del formulario) de forma permanente. ' +
          'Los leads que ya ha recibido NO se borran de la base de datos, pero dejarán de verse desde ' +
          'el panel porque no quedará ninguna campaña a la que asociarlos.\n\n' +
          'Si solo quieres retirarla sin perder ese acceso, cierra este aviso y cambia su estado a ' +
          '«Finalizada» en vez de borrarla.\n\n' +
          'Esta acción no se puede deshacer. ¿Seguro?'
        );
        if (!ok) return;
        btn.disabled = true;
        ctx.api('/rest/v1/anunciantes_destino?slug=eq.' + encodeURIComponent(a.slug), { method: 'DELETE' })
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return; }
            if (!r.ok) throw new Error('No se pudo eliminar la campaña.');
            cargarLista();
          })
          .catch(function (e) { alert(e.message); btn.disabled = false; });
      });

      return btn;
    }

    // Enlace del QR: siempre a la vista en la ficha, no solo en la pantalla de "Campaña creada".
    function bloqueEnlace(a) {
      var sec = el('section', 'p-bloque');
      sec.appendChild(el('h2', 'p', 'Enlace del QR'));
      var fila = enlaceQr(a.slug, false);
      var qr = el('button', 'btn sec mini', 'Generar su QR'); qr.type = 'button';
      qr.addEventListener('click', function () { ctx.irA('qr', a.slug); });
      fila.appendChild(qr);
      sec.appendChild(fila);
      sec.appendChild(el('p', 'p-note', 'Es la dirección que lleva el QR impreso y no cambia nunca: pausar, ' +
        'reanudar o finalizar la campaña no obliga a reimprimirlo.'));
      return sec;
    }

    // 3.2 — Estado: separado de la ficha porque es la acción más urgente (dar de baja un QR ya impreso
    // no debería esperar a rellenar el resto del formulario). Solo se ofrecen los pasos permitidos:
    // borrador → activa; activa ⇄ pausada; activa/pausada → finalizada, sin vuelta atrás desde el panel.
    // El QR impreso apunta siempre a la misma dirección: ningún cambio de estado obliga a reimprimirlo.
    var TRANSICIONES = {
      borrador: [['activa', 'Lanzar campaña', 'btn']],
      activa: [['pausada', 'Pausar', 'btn sec'], ['finalizada', 'Finalizar', 'btn sec peligro']],
      pausada: [['activa', 'Reanudar', 'btn'], ['finalizada', 'Finalizar', 'btn sec peligro']],
      finalizada: []
    };
    var EXPLICA = {
      borrador: 'Borrador: el QR todavía no muestra el formulario ni se aceptan envíos. Lánzala cuando esté lista.',
      activa: 'Activa: el QR muestra el formulario y los contactos llegan al anunciante.',
      pausada: 'Pausada: el QR muestra un aviso de no disponible y no se aceptan envíos. Se puede reanudar.',
      finalizada: 'Finalizada: el QR muestra un aviso de no disponible. No se puede reactivar desde el panel.'
    };

    function bloqueEstado(a) {
      var sec = el('section', 'p-bloque');
      sec.appendChild(el('h2', 'p', 'Estado'));
      var cuerpo = el('div');
      sec.appendChild(cuerpo);
      var msg = el('p', 'p-note');

      function pintar() {
        ctx.clear(cuerpo);
        var info = ESTADOS[a.estado] || { etiqueta: a.estado, clase: '' };
        var fila = el('div', 'estado-fila');
        fila.appendChild(el('span', 'badge ' + info.clase, info.etiqueta));
        (TRANSICIONES[a.estado] || []).forEach(function (t) {
          var b = el('button', t[2] + ' mini', t[1]); b.type = 'button';
          b.addEventListener('click', function () { cambiar(t[0]); });
          fila.appendChild(b);
        });
        cuerpo.append(fila, el('p', 'p-note', EXPLICA[a.estado] || ''), msg);
      }

      function cambiar(nuevo) {
        var nombre = a.nombre_mostrado || a.slug;
        if (nuevo === 'finalizada' && !confirm('¿Finalizar la campaña «' + nombre + '»?\n\nEl QR dejará de mostrar el ' +
          'formulario y no se podrá reactivar desde el panel.')) return;
        // La revisión legal pide identificar al anunciante antes de que el QR reciba contactos reales.
        if (nuevo === 'activa' && a.estado === 'borrador' && !(a.razon_social && a.cif && a.email_privacidad) &&
          !confirm('A «' + nombre + '» le falta la razón social, el CIF o el email de privacidad (en la ficha, más abajo).\n\n' +
            'Hacen falta antes de que el QR reciba contactos reales. ¿Lanzarla igualmente?')) return;
        Array.from(cuerpo.querySelectorAll('button')).forEach(function (b) { b.disabled = true; });
        msg.className = 'p-note'; msg.textContent = '';
        // return=representation: un PATCH que la base de datos no aplica responde igualmente 2xx.
        ctx.api('/rest/v1/anunciantes_destino?slug=eq.' + encodeURIComponent(a.slug), {
          method: 'PATCH', body: JSON.stringify({ estado: nuevo }), headers: { Prefer: 'return=representation' }
        }).then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('No se pudo cambiar el estado.');
          return r.json();
        }).then(function (filas) {
          if (filas === null) return;
          if (!Array.isArray(filas) || filas.length !== 1) throw new Error('No se guardó el cambio. Recarga el panel y vuelve a intentarlo.');
          a.estado = nuevo;
          pintar();
          msg.textContent = 'Guardado.';
        }).catch(function (e) {
          pintar();
          msg.className = 'p-err'; msg.textContent = e.message;
        });
      }

      pintar();
      return sec;
    }

    // Logo de la campaña: se sube directo al bucket público anunciantes-logos (Supabase Storage) y
    // /lead/<slug> lo carga desde ahí al instante — no hace falta commitear ningún archivo al repo.
    var TIPOS_LOGO = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    var MAX_LOGO = 2 * 1024 * 1024;

    // Color dominante del logo, calculado en un <canvas> en el propio navegador (nada se envía a
    // ningún sitio para esto). Ignora casi-blanco (fondo habitual de un logo) y casi-negro (texto/
    // contorno, poco representativo como "color de marca"); agrupa tonos parecidos para no acabar
    // con dos colores casi iguales como principal/secundario.
    function detectarColores(file) {
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        function limpiar() { URL.revokeObjectURL(url); }
        img.onload = function () {
          try {
            var tam = 80;
            var cv = document.createElement('canvas'); cv.width = tam; cv.height = tam;
            var cx = cv.getContext('2d');
            cx.drawImage(img, 0, 0, tam, tam);
            var datos = cx.getImageData(0, 0, tam, tam).data;
            var cuentas = {};
            for (var i = 0; i < datos.length; i += 4) {
              var r = datos[i], g = datos[i + 1], b = datos[i + 2], al = datos[i + 3];
              if (al < 128) continue;
              if (r > 235 && g > 235 && b > 235) continue;
              if (r < 20 && g < 20 && b < 20) continue;
              var rq = Math.round(r / 24) * 24, gq = Math.round(g / 24) * 24, bq = Math.round(b / 24) * 24;
              var clave = rq + ',' + gq + ',' + bq;
              cuentas[clave] = (cuentas[clave] || 0) + 1;
            }
            var lista = Object.keys(cuentas).map(function (k) {
              var p = k.split(',').map(Number);
              return { r: p[0], g: p[1], b: p[2], n: cuentas[k] };
            }).sort(function (x, y) { return y.n - x.n; });
            function hex(c) {
              function h2(v) { return Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0'); }
              return '#' + h2(c.r) + h2(c.g) + h2(c.b);
            }
            function distancia(x, y) { return Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b); }
            var principal = lista[0];
            if (!principal) { limpiar(); resolve(null); return; }
            var secundario = null;
            for (var j = 1; j < lista.length; j++) {
              if (distancia(lista[j], principal) > 90) { secundario = lista[j]; break; }
            }
            limpiar();
            resolve({ color: hex(principal), colorSecundario: secundario ? hex(secundario) : null });
          } catch (e) { limpiar(); resolve(null); }
        };
        img.onerror = function () { limpiar(); resolve(null); };
        img.src = url;
      });
    }

    // Recorta los márgenes vacíos (transparentes, o del color de la esquina si la imagen es opaca) antes de
    // subir el logo: un PNG de 447×447 con el logo real en una franja de 396×96 salía diminuto en la landing
    // (diagnóstico de la Fase 0). SVG se sube tal cual; si no hay casi nada que recortar, el archivo original.
    function recortarMargenes(file) {
      if (file.type === 'image/svg+xml') return Promise.resolve(file);
      return new Promise(function (resolve) {
        var url = URL.createObjectURL(file), img = new Image();
        function fin(x) { URL.revokeObjectURL(url); resolve(x); }
        img.onerror = function () { fin(file); };
        img.onload = function () {
          try {
            var w = img.naturalWidth, h = img.naturalHeight;
            var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
            var d = cx.getImageData(0, 0, w, h).data;
            var f = [d[0], d[1], d[2], d[3]];
            function vacio(i) {
              if (d[i + 3] < 16) return true;
              if (f[3] < 16) return false;
              return Math.abs(d[i] - f[0]) + Math.abs(d[i + 1] - f[1]) + Math.abs(d[i + 2] - f[2]) < 40;
            }
            var x0 = w, y0 = h, x1 = -1, y1 = -1;
            for (var y = 0; y < h; y++) {
              for (var x = 0; x < w; x++) {
                if (vacio((y * w + x) * 4)) continue;
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                y1 = y;
              }
            }
            if (x1 < 0) { fin(file); return; }
            var m = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
            x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
            var cw = x1 - x0 + 1, ch = y1 - y0 + 1;
            if (cw * ch > w * h * 0.9) { fin(file); return; }
            var out = document.createElement('canvas'); out.width = cw; out.height = ch;
            out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
            out.toBlob(function (b) { fin(b && TIPOS_LOGO[b.type] ? b : file); }, file.type, 0.92);
          } catch (e) { fin(file); }
        };
        img.src = url;
      });
    }

    function bloqueLogo(a, iColor, iColorSec, iEscala) {
      var wrap = el('div', 'field logo-campo');
      wrap.appendChild(el('label', 'lbl', 'Logo'));
      var preview = el('div', 'logo-preview');
      // Vista previa al mismo tamaño que en /lead/<slug> (misma regla que .adv-head img en lead.css).
      function aplicarEscala() {
        if (iEscala) preview.style.setProperty('--logo-escala', String(parseInt(iEscala.value, 10) / 100));
      }
      function pintarPreview() {
        ctx.clear(preview);
        if (a.tema_logo) {
          var muestra = el('div', 'logo-muestra');
          var img = el('img'); img.src = a.tema_logo + (a.tema_logo.indexOf('supabase.co') !== -1 ? '?v=' + Date.now() : '');
          img.alt = '';
          muestra.appendChild(img);
          preview.appendChild(muestra);
        } else {
          preview.appendChild(el('p', 'p-note', 'Todavía no tiene logo.'));
        }
      }
      pintarPreview();
      aplicarEscala();

      var errLogo = el('div', 'p-err'); errLogo.style.display = 'none';
      var notaColores = el('p', 'p-note'); notaColores.style.display = 'none';
      var inputLogo = el('input'); inputLogo.type = 'file'; inputLogo.accept = '.png,.jpg,.jpeg,.webp,.svg';
      var subirLogo = el('button', 'btn sec', 'Subir logo'); subirLogo.type = 'button';

      subirLogo.addEventListener('click', function () {
        errLogo.style.display = 'none';
        notaColores.style.display = 'none';
        var file = inputLogo.files && inputLogo.files[0];
        if (!file) { errLogo.textContent = 'Elige una imagen primero.'; errLogo.style.display = 'block'; return; }
        if (file.size > MAX_LOGO) { errLogo.textContent = 'La imagen pesa más de 2 MB.'; errLogo.style.display = 'block'; return; }
        if (!TIPOS_LOGO[file.type]) { errLogo.textContent = 'Usa PNG, JPG, WEBP o SVG.'; errLogo.style.display = 'block'; return; }
        var ruta;
        subirLogo.disabled = true;
        recortarMargenes(file).then(function (arch) {
          ruta = a.slug + '/logo.' + TIPOS_LOGO[arch.type];
          return Promise.all([
            ctx.api('/storage/v1/object/anunciantes-logos/' + ruta.split('/').map(encodeURIComponent).join('/'), {
              method: 'POST', body: arch, contentType: arch.type, headers: { 'x-upsert': 'true' }
            }),
            detectarColores(arch)
          ]);
        }).then(function (res) {
          var r = res[0], colores = res[1];
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
            throw new Error((b && b.message) || 'No se pudo subir el logo.');
          });
          return colores;
        }).then(function (colores) {
          if (colores === undefined) return; // ya se gestionó (401)
          var url = ctx.supabaseUrl + '/storage/v1/object/public/anunciantes-logos/' + ruta;
          // Los colores se guardan junto al logo, sin paso aparte: si solo rellenáramos el formulario
          // a la espera de "Guardar ficha", quedan sin aplicar hasta que alguien pulse ese botón por
          // separado — y eso es fácil de dar por hecho ya guardado, como pasó la primera vez con esto.
          var payload = { tema_logo: url };
          var legible = true;
          if (colores) {
            // Si el color del logo no deja leer el texto blanco de los botones, se guarda el morado de marca
            // y la campaña queda marcada para revisar el color a mano.
            legible = contrasteBlanco(colores.color) >= CONTRASTE_MIN;
            payload.tema_color = legible ? colores.color : COLOR_MARCA;
            payload.tema_color_secundario = colores.colorSecundario || null;
            if (Object.prototype.hasOwnProperty.call(a, 'tema_color_origen')) payload.tema_color_origen = legible ? 'auto' : 'revisar';
          }
          return ctx.api('/rest/v1/anunciantes_destino?slug=eq.' + encodeURIComponent(a.slug), {
            method: 'PATCH', body: JSON.stringify(payload)
          }).then(function (r2) {
            if (r2.status === 401) { ctx.sesionCaducada(); return; }
            if (!r2.ok) throw new Error('El logo se subió pero no se pudo guardar en la ficha.');
            Object.assign(a, payload);
            pintarPreview();
            inputLogo.value = '';
            // 'input' para que el selector de color y el aviso de contraste se actualicen también.
            if (iColor) { iColor.value = a.tema_color || ''; iColor.dispatchEvent(new Event('input')); }
            if (iColorSec) { iColorSec.value = a.tema_color_secundario || ''; iColorSec.dispatchEvent(new Event('input')); }
            notaColores.textContent = !colores
              ? 'Logo guardado. No se pudieron detectar colores automáticamente; puedes elegirlos abajo y pulsar «Guardar ficha».'
              : legible ? 'Logo y colores del tema guardados.'
              : 'Logo guardado. El color del logo (' + colores.color + ') no contrasta lo bastante con el texto blanco ' +
                '(mínimo 3:1): se usa el morado de Candy Ads hasta que elijas otro abajo.';
            notaColores.style.display = 'block';
          });
        }).catch(function (e) { errLogo.textContent = e.message; errLogo.style.display = 'block'; })
          .then(function () { subirLogo.disabled = false; });
      });

      wrap.append(preview, errLogo, inputLogo, subirLogo, notaColores);
      if (iEscala) {
        var etq = el('label', 'lbl logo-escala-lbl');
        function rotulo() { etq.textContent = 'Tamaño del logo en el formulario: ' + iEscala.value + '% (se guarda con «Guardar ficha»)'; }
        rotulo();
        iEscala.addEventListener('input', function () { rotulo(); aplicarEscala(); });
        wrap.append(etq, iEscala);
      }
      return wrap;
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
      var color = campoColor('Color del formulario público', a.tema_color, true);
      var colorSec = campoColor('Color secundario', a.tema_color_secundario, false);
      // Origen del color (migración 20260929010000_color_origen.sql). Solo si la columna ya existe.
      var conOrigen = Object.prototype.hasOwnProperty.call(a, 'tema_color_origen');
      var conCliente = Object.prototype.hasOwnProperty.call(a, 'crm_cliente_id');
      var fCliente = el('div', 'field');
      var sCliente = el('select');
      if (conCliente) {
        fCliente.appendChild(el('label', 'lbl', 'Cliente del CRM'));
        fCliente.appendChild(sCliente);
        fCliente.appendChild(el('p', 'p-note', 'Con el cliente asociado, su ficha en el CRM muestra los leads y ventas de esta campaña.'));
        cargarClientesCrm(sCliente, a.crm_cliente_id);
      }
      var origen = el('p', 'p-note');
      function pintarOrigen() {
        var o = a.tema_color_origen;
        origen.className = 'p-note' + (o === 'revisar' ? ' color-revisar' : '');
        origen.textContent = o === 'auto' ? 'Detectado automáticamente del logo.'
          : o === 'manual' ? 'Elegido a mano.'
          : o === 'revisar' ? '⚠ Pendiente de revisión manual: el color del logo no tenía contraste suficiente y se está usando el morado de Candy Ads.'
          : '';
      }
      if (conOrigen) {
        pintarOrigen();
        color.wrap.appendChild(origen);
        // Al subir un logo, bloqueLogo actualiza a.tema_color_origen y lanza 'input' en este campo.
        color.input.addEventListener('input', pintarOrigen);
      }

      // El logo se sube aparte (bloqueLogo), pero al detectar sus colores rellena estos mismos campos
      // para revisarlos antes de guardar la ficha.
      // Escala del logo (50–200 %). Solo si la columna ya existe (migración 20260929000000_logo_escala.sql):
      // así este archivo se puede publicar antes que la migración sin romper "Guardar ficha".
      var iEscala = null;
      if (Object.prototype.hasOwnProperty.call(a, 'logo_landing_escala')) {
        iEscala = el('input'); iEscala.type = 'range'; iEscala.min = 50; iEscala.max = 200; iEscala.step = 5;
        iEscala.value = a.logo_landing_escala || 100;
      }
      sec.appendChild(bloqueLogo(a, color.input, colorSec.input, iEscala));

      var editor = editorCampos(a);
      var fCampos = editor.wrap;

      var guardar = el('button', 'btn', 'Guardar ficha'); guardar.type = 'submit';
      var msg = el('p', 'p-note');
      form.append(err, nombre.wrap, emailDestino.wrap, fLimite, razon.wrap, cif.wrap, emailPriv.wrap,
        sector.wrap, zona.wrap, fCliente, color.wrap, colorSec.wrap, fCampos, guardar, msg);
      sec.appendChild(form);
      var historial = historialEmail(a);
      sec.appendChild(historial.wrap);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        err.style.display = 'none'; msg.textContent = '';
        var colorHex = valOrNull(color.input), colorSecHex = valOrNull(colorSec.input);
        if (colorHex && !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
          err.textContent = 'El color principal debe tener el formato #RRGGBB.'; err.style.display = 'block'; return;
        }
        if (colorSecHex && !/^#[0-9a-fA-F]{6}$/.test(colorSecHex)) {
          err.textContent = 'El color secundario debe tener el formato #RRGGBB.'; err.style.display = 'block'; return;
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
          campos_formulario: editor.valor(),
          // Lista antigua de claves, solo por compatibilidad mientras quede algo que la lea.
          campos: editor.valor().map(function (d) { return d.key; }).filter(function (k) { return window.CandyFormulario.LEGADO[k]; })
        };
        if (!payload.campos_formulario.length) {
          err.textContent = 'El formulario necesita al menos un campo.'; err.style.display = 'block'; return;
        }
        if (iEscala) payload.logo_landing_escala = parseInt(iEscala.value, 10);
        if (conCliente && !sCliente.disabled) payload.crm_cliente_id = sCliente.value ? parseInt(sCliente.value, 10) : null;
        if (conOrigen) {
          if (!colorHex) payload.tema_color_origen = null;
          else if (colorHex.toLowerCase() !== String(a.tema_color || '').toLowerCase()) payload.tema_color_origen = 'manual';
        }
        // email_destino decide a quién llegan los datos personales de cada lead: una errata los manda a otra
        // persona. Por eso, si cambia, se pide confirmación mostrando el antes y el después.
        var cambiaDestino = payload.email_destino.toLowerCase() !== String(a.email_destino || '').toLowerCase();
        if (cambiaDestino && !confirm(
          '¿Cambiar el email donde llegan los leads de «' + (a.nombre_mostrado || a.slug) + '»?\n\n' +
          'Antes: ' + (a.email_destino || '(ninguno)') + '\n' +
          'Ahora: ' + payload.email_destino + '\n\n' +
          'Desde el próximo lead, los datos de quien rellene el formulario llegarán a esta dirección. ' +
          'Revisa que está bien escrita. El cambio queda registrado (quién y cuándo).')) return;
        guardar.disabled = true;
        // return=representation: si la base de datos no actualiza ninguna fila (p. ej. la RLS la bloquea),
        // PostgREST responde igualmente 2xx; así se detecta y no se muestra "Guardado" sin haberlo guardado.
        ctx.api('/rest/v1/anunciantes_destino?slug=eq.' + encodeURIComponent(a.slug), {
          method: 'PATCH', body: JSON.stringify(payload), headers: { Prefer: 'return=representation' }
        })
          .then(function (r) {
            if (r.status === 401) { ctx.sesionCaducada(); return; }
            if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
              throw new Error((b && b.message) || 'No se pudo guardar la ficha.');
            });
            return r.json().then(function (filas) {
              if (!Array.isArray(filas) || filas.length !== 1) throw new Error('No se guardó ningún cambio. Recarga el panel y vuelve a intentarlo.');
              Object.assign(a, payload);
              if (conOrigen) pintarOrigen();
              if (cambiaDestino) historial.recargar();
              guardar.disabled = false;
              msg.textContent = cambiaDestino ? 'Guardado. Los próximos leads llegarán a ' + payload.email_destino + '.' : 'Guardado.';
            });
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

    // Desde el CRM («Abrir campaña») se llega con el slug: directo a su ficha.
    if (typeof param === 'string' && /^[a-z0-9][a-z0-9-]{0,60}$/.test(param)) abrirDetalle(param);
    else cargarLista();
  }

  PanelCore.registrar({ id: 'campanas', titulo: 'Campañas', montar: montar });
})();
