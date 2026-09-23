(function () {
  'use strict';

  // URL base del backend en AWS Lambda (rutas /challenge y /lead). Vacío = modo demostración: no se envía nada.
  // En localhost se usa un backend de pruebas del mismo origen.
  var ENDPOINT = location.hostname === 'localhost' ? '/api' : 'https://rx4ydbbhvlm4zuyo3p5ci3an3q0filte.lambda-url.eu-west-1.on.aws';
  var MIN_MS = 2500;
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

  var CATALOGO = {
    nombre: { label: 'Nombre', type: 'text', required: true, autocomplete: 'name', max: 80,
      error: 'Escribe tu nombre' },
    telefono: { label: 'Teléfono', type: 'tel', required: true, autocomplete: 'tel', max: 20,
      error: 'Escribe un teléfono válido' },
    email: { label: 'Email', type: 'email', required: false, autocomplete: 'email', max: 120,
      error: 'Escribe un email válido' },
    interes_venta_alquiler: { label: '¿Qué necesitas?', type: 'select', required: true,
      options: ['Quiero vender mi vivienda', 'Quiero alquilar mi vivienda', 'Busco comprar', 'Busco alquilar', 'Otra consulta'],
      error: 'Elige una opción' },
    mensaje: { label: 'Mensaje', type: 'textarea', required: false, max: 500 }
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
      });
    }
    if (text != null) n.textContent = text;
    return n;
  }

  function getSlug() {
    var q = new URLSearchParams(location.search).get('s');
    var m = location.pathname.match(/^\/lead\/([^\/]+)\/?$/);
    var s = String(q || (m && m[1]) || '').toLowerCase();
    return SLUG_RE.test(s) ? s : null;
  }

  // Config de la campaña: la sirve la Lambda desde Supabase (no un JSON del repo), para que un cambio de
  // ficha o de estado hecho en el panel se refleje aquí al instante, sin caché de GitHub Pages de por medio.
  function loadConfig(slug) {
    return fetch(ENDPOINT + '/config?slug=' + encodeURIComponent(slug), { cache: 'no-cache', credentials: 'omit' })
      .then(function (r) {
        if (r.status === 404) { var e = new Error('no encontrado'); e.noEncontrado = true; throw e; }
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(function (c) {
        if (!c || c.estado !== 'activa' || typeof c.nombre_mostrado !== 'string' || !Array.isArray(c.campos)) {
          throw new Error('inactivo');
        }
        return c;
      });
  }

  var HEX_RE = /^#[0-9a-fA-F]{6}$/;
  // Acepta la ruta antigua (archivo commiteado en el repo) o la URL pública del bucket de logos
  // subidos desde el panel (Supabase Storage, bucket anunciantes-logos).
  var LOGO_RE = /^(\/assets\/anunciantes\/[a-z0-9._-]+\.(png|svg|jpg|jpeg|webp)|https:\/\/eceqcveqsbcfbmbaczed\.supabase\.co\/storage\/v1\/object\/public\/anunciantes-logos\/.+\.(png|svg|jpg|jpeg|webp))$/i;

  function rgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
  }

  function aplicarTema(cfg) {
    var t = cfg.tema;
    if (!t) return;
    var root = document.documentElement.style;
    if (HEX_RE.test(t.color || '')) {
      var c = rgb(t.color);
      root.setProperty('--adv', t.color);
      root.setProperty('--adv-rgb', c.join(','));
      root.setProperty('--adv-dark', 'rgb(' + c.map(function (v) { return Math.round(v * 0.78); }).join(',') + ')');
    }
    if (HEX_RE.test(t.color_secundario || '')) root.setProperty('--adv-2', t.color_secundario);
  }

  function cabeceraAnunciante(cfg) {
    var head = el('div', { 'class': 'adv-head' });
    var logo = cfg.tema && cfg.tema.logo;
    function texto() {
      head.textContent = '';
      head.appendChild(el('span', { 'class': 'adv-name' }, cfg.nombre_mostrado));
    }
    if (typeof logo === 'string' && LOGO_RE.test(logo)) {
      var img = el('img', { src: logo, alt: cfg.nombre_mostrado });
      img.addEventListener('error', texto);
      head.appendChild(img);
    } else {
      texto();
    }
    return head;
  }

  // El build "external" de ALTCHA no lleva workers: hay que registrarlos (mismo origen, sin blobs).
  function prepararAltcha() {
    return customElements.whenDefined('altcha-widget').then(function () {
      var A = window.$altcha;
      if (!A || !A.algorithms) return;
      ['PBKDF2/SHA-256', 'PBKDF2/SHA-384', 'PBKDF2/SHA-512'].forEach(function (alg) {
        A.algorithms.set(alg, function () { return new Worker('/assets/altcha/pbkdf2.js'); });
      });
    });
  }

  // Devuelve el payload firmado de ALTCHA (base64) o '' si no se pudo verificar.
  function obtenerAltcha(widget, form) {
    if (!widget) return Promise.resolve('');
    return prepararAltcha().then(function () {
      return widget.getState() === 'verified' ? null : widget.verify();
    }).then(function () {
      return (form.elements.altcha && form.elements.altcha.value) || '';
    }).catch(function () { return ''; });
  }

  function validar(def, v) {
    if (!v) return def.required ? (def.error || 'Campo obligatorio') : '';
    if (def.type === 'tel') {
      var d = v.replace(/\D/g, '');
      if (!/^\+?[0-9 ()\-]+$/.test(v) || d.length < 9 || d.length > 15) return def.error;
    }
    if (def.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return def.error;
    if (def.type === 'select' && def.options.indexOf(v) === -1) return def.error;
    return '';
  }

  function estadoVacio(card, titulo, texto) {
    card.textContent = '';
    card.appendChild(el('p', { 'class': 'eyebrow' }, 'Candy Ads'));
    card.appendChild(el('h1', null, titulo));
    card.appendChild(el('p', { 'class': 'lead' }, texto));
    var a = el('a', { href: '/' }, 'Ir a candyads.es');
    card.appendChild(a);
  }

  function buildCampo(id, def) {
    var wrap = el('div', { 'class': 'field', 'data-id': id });
    var lbl = el('label', { 'class': 'lbl', 'for': 'f-' + id }, def.label);
    if (!def.required) lbl.appendChild(el('span', { 'class': 'opt' }, ' (opcional)'));
    var ctl;
    if (def.type === 'select') {
      ctl = el('select', { id: 'f-' + id, name: id });
      ctl.appendChild(el('option', { value: '' }, 'Selecciona…'));
      def.options.forEach(function (o) { ctl.appendChild(el('option', { value: o }, o)); });
    } else if (def.type === 'textarea') {
      ctl = el('textarea', { id: 'f-' + id, name: id, maxlength: String(def.max || 500) });
    } else {
      ctl = el('input', { id: 'f-' + id, name: id, type: def.type, maxlength: String(def.max || 120) });
      if (def.autocomplete) ctl.setAttribute('autocomplete', def.autocomplete);
      if (def.type === 'tel') ctl.setAttribute('inputmode', 'tel');
    }
    ctl.setAttribute('aria-describedby', 'err-' + id);
    wrap.appendChild(lbl);
    wrap.appendChild(ctl);
    wrap.appendChild(el('p', { 'class': 'msg-err', id: 'err-' + id }, def.error || 'Campo obligatorio'));
    return wrap;
  }

  function gracias(slug, demo) {
    location.href = '/gracias.html?s=' + encodeURIComponent(slug) + (demo ? '&demo=1' : '');
  }

  function renderForm(app, slug, cfg) {
    var nombre = cfg.nombre_mostrado;
    var responsable = typeof cfg.responsable === 'string' && cfg.responsable ? cfg.responsable : nombre;
    // Identificación formal del anunciante (razón social + NIF), cuando el anunciante ya la tiene
    // configurada. Si falta cualquiera de los tres datos, se usa el nombre comercial como hasta ahora:
    // nunca se inventa ni se deja un hueco con un placeholder.
    var idCompleta = typeof cfg.razon_social === 'string' && cfg.razon_social
      && typeof cfg.nif_cif === 'string' && cfg.nif_cif
      && typeof cfg.email_privacidad === 'string' && cfg.email_privacidad;
    var razonSocial = idCompleta ? cfg.razon_social : responsable;
    var t0 = Date.now();

    document.title = 'Contacta con ' + nombre;
    aplicarTema(cfg);
    app.textContent = '';
    app.appendChild(cabeceraAnunciante(cfg));
    app.appendChild(el('p', { 'class': 'eyebrow' }, 'Contacto'));
    app.appendChild(el('h1', null, 'Habla con ' + nombre));
    app.appendChild(el('p', { 'class': 'lead' },
      'Déjanos tus datos y ' + nombre + ' se pondrá en contacto contigo lo antes posible.'));
    var trust = el('ul', { 'class': 'trust' });
    ['Sin compromiso', 'Tus datos van solo a ' + nombre, 'Candy Ads no los guarda'].forEach(function (t) {
      trust.appendChild(el('li', null, t));
    });
    app.appendChild(trust);

    if (!ENDPOINT) {
      app.appendChild(el('div', { 'class': 'demo' },
        'Modo demostración: este formulario todavía no envía nada. Puedes probarlo con datos ficticios.'));
    }

    var form = el('form', { id: 'lead-form', novalidate: 'novalidate', autocomplete: 'on' });
    var campos = cfg.campos.filter(function (id) { return CATALOGO[id]; });
    campos.forEach(function (id) { form.appendChild(buildCampo(id, CATALOGO[id])); });

    var hp = el('div', { 'class': 'hp', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { 'for': 'f-web_site' }, 'No rellenar este campo'));
    hp.appendChild(el('input', { id: 'f-web_site', name: 'web_site', type: 'text', tabindex: '-1', autocomplete: 'off' }));
    form.appendChild(hp);

    var widget = null;
    if (ENDPOINT) {
      widget = document.createElement('altcha-widget');
      widget.setAttribute('challenge', ENDPOINT + '/challenge');
      widget.setAttribute('name', 'altcha');
      widget.setAttribute('language', 'es-es');
      form.appendChild(widget);
      prepararAltcha().then(function () {
        widget.configure({ auto: 'onfocus', hideFooter: true, hideLogo: true });
      });
    }

    // Casilla desmarcada por defecto (el elemento no lleva "checked"), con redacción específica de la
    // finalidad concreta: a quién van los datos y para qué, no un genérico "acepto la política de privacidad".
    var cf = el('div', { 'class': 'field consent-field' });
    var consent = el('div', { 'class': 'consent' });
    consent.appendChild(el('input', { type: 'checkbox', id: 'f-consent', name: 'consent', 'aria-describedby': 'err-consent' }));
    consent.appendChild(el('label', { 'for': 'f-consent' },
      'Consiento que mis datos sean enviados a ' + razonSocial + ' para que me contacte en relación con mi solicitud.'));
    cf.appendChild(consent);
    cf.appendChild(el('p', { 'class': 'msg-err', id: 'err-consent' }, 'Necesitas aceptar para poder enviar tu solicitud.'));
    form.appendChild(cf);
    form.appendChild(el('p', { 'class': 'privacy-note' }, 'Si tienes menos de 14 años, pide a un adulto que rellene este formulario por ti.'));

    var det = el('details', { 'class': 'rgpd' });
    det.appendChild(el('summary', null, 'Información básica sobre protección de datos'));
    var ul = el('ul');
    (idCompleta ? [
      'Responsable: ' + cfg.razon_social + ', NIF ' + cfg.nif_cif + ', ' + cfg.email_privacidad + '.',
      'Finalidad: gestionar tu solicitud de contacto.',
      'Base jurídica: tu consentimiento.',
      'Candy Ads (Miguel Cabrera Rodríguez, NIF 29541337E) transmite tu solicitud por cuenta del responsable y no la conserva.',
      'Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad, ante ' + cfg.razon_social + ' en ' + cfg.email_privacidad + ', o ante Candy Ads en equipo@candyads.es, que la trasladará.'
    ] : [
      'Responsable: ' + responsable + '.',
      'Finalidad: atender tu solicitud de contacto.',
      'Legitimación: tu consentimiento.',
      'Destinatario: tus datos se envían directamente a ' + nombre + '. Candy Ads solo transmite tu mensaje y no conserva tus datos personales; únicamente registra un contador anónimo de solicitudes.',
      'Derechos: acceso, rectificación, supresión, oposición, limitación y portabilidad, dirigiéndote a ' + responsable + '.'
    ]).forEach(function (t) { ul.appendChild(el('li', null, t)); });
    det.appendChild(ul);
    var more = el('p');
    more.appendChild(document.createTextNode('Más información en la '));
    more.appendChild(el('a', { href: '/politica-privacidad.html', target: '_blank', rel: 'noopener' }, 'Política de Privacidad'));
    more.appendChild(document.createTextNode(' de Candy Ads.'));
    det.appendChild(more);
    form.appendChild(det);

    var formErr = el('div', { 'class': 'form-err', role: 'alert', id: 'form-err' });
    form.appendChild(formErr);

    var btn = el('button', { type: 'submit', 'class': 'btn' }, 'Enviar solicitud');
    form.appendChild(btn);
    app.appendChild(form);

    function fail(msg) {
      formErr.textContent = msg;
      formErr.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Enviar solicitud';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formErr.classList.remove('show');
      var datos = {};
      var primero = null;

      campos.forEach(function (id) {
        var def = CATALOGO[id];
        var ctl = form.elements[id];
        var v = (ctl.value || '').trim();
        var err = validar(def, v);
        var wrap = ctl.closest('.field');
        wrap.classList.toggle('invalid', !!err);
        if (err && !primero) primero = ctl;
        datos[id] = v;
      });

      var chk = form.elements.consent;
      cf.classList.toggle('invalid', !chk.checked);
      if (!chk.checked && !primero) primero = chk;

      if (primero) { primero.focus(); return; }

      btn.disabled = true;
      btn.textContent = 'Enviando…';

      if (form.elements.web_site.value) { gracias(slug, !ENDPOINT); return; }

      function reiniciarAltcha() { if (widget) { try { widget.reset(); } catch (e) { /* sin widget */ } } }
      function fallo(msg) { reiniciarAltcha(); fail(msg); }

      obtenerAltcha(widget, form).then(function (payload) {
        if (ENDPOINT && !payload) {
          fallo('No hemos podido comprobar que eres una persona. Vuelve a intentarlo.');
          return;
        }
        var espera = Math.max(0, MIN_MS - (Date.now() - t0));
        setTimeout(function () {
          if (!ENDPOINT) { setTimeout(function () { gracias(slug, true); }, 500); return; }
          fetch(ENDPOINT + '/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug, datos: datos, consentimiento: true, t: Date.now() - t0, altcha: payload }),
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
          }).then(function (r) {
            if (r.ok) { gracias(slug, false); return; }
            return r.json().catch(function () { return {}; }).then(function (cuerpo) {
              var code = (cuerpo && cuerpo.code) || '';
              if (code === 'limite_diario') fallo(nombre + ' no puede recibir más solicitudes hoy. Inténtalo de nuevo mañana.');
              else if (r.status === 429) fallo('Has enviado demasiadas solicitudes. Inténtalo de nuevo en unos minutos.');
              else if (code.indexOf('altcha') === 0) fallo('La comprobación ha caducado. Pulsa de nuevo en "Enviar solicitud".');
              else if (code.indexOf('datos_') === 0) fallo('Revisa los datos del formulario e inténtalo de nuevo.');
              else fallo('No hemos podido enviar tu solicitud. Inténtalo de nuevo en unos minutos.');
            });
          }).catch(function () {
            fallo('No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo.');
          });
        }, espera);
      });
    });
  }

  function initLead() {
    var app = $('app');
    var slug = getSlug();
    if (!slug) {
      estadoVacio(app, 'Este enlace no es válido', 'Comprueba que has escaneado bien el código del sobre.');
      return;
    }
    loadConfig(slug).then(function (cfg) { renderForm(app, slug, cfg); }).catch(function (e) {
      if (e && e.noEncontrado) {
        estadoVacio(app, 'Este enlace ya no está activo',
          'Si has llegado desde un sobre de azúcar, puede que la campaña haya terminado.');
      } else {
        estadoVacio(app, 'Gracias por tu interés',
          'Este contacto no está disponible en este momento.');
      }
    });
  }

  var REF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Enlace de un clic que llega en el correo del lead: el anunciante confirma si terminó en venta.
  // Solo lleva la referencia aleatoria del envío, sin ningún dato de la persona.
  function pintarConfirmar(app, ref, r) {
    app.textContent = '';
    app.appendChild(el('p', { 'class': 'eyebrow' }, 'Candy Ads'));
    app.appendChild(el('h1', null, r === 'venta' ? '¿Confirmas que fue venta?' : '¿Confirmas que no fue venta, de momento?'));
    app.appendChild(el('p', { 'class': 'lead' },
      'Lo anotamos en el sistema de Candy Ads. No identifica quién era el contacto: solo dice si este envío concreto terminó en venta.'));

    var formErr = el('div', { 'class': 'form-err', role: 'alert' });
    app.appendChild(formErr);

    var btn = el('button', { type: 'button', 'class': 'btn' }, 'Confirmar');
    app.appendChild(btn);

    var pCambiar = el('p', { 'class': 'privacy-note' });
    pCambiar.appendChild(el('a', { href: '?ref=' + encodeURIComponent(ref) + '&r=' + (r === 'venta' ? 'sin_venta' : 'venta') },
      r === 'venta' ? 'Me he equivocado: no fue venta' : 'Me he equivocado: sí fue venta'));
    app.appendChild(pCambiar);

    function hecho() {
      app.textContent = '';
      app.appendChild(el('div', { 'class': 'tick', 'aria-hidden': 'true' }, '✓'));
      app.appendChild(el('h1', null, '¡Anotado!'));
      app.appendChild(el('p', { 'class': 'lead' }, 'Gracias por confirmarlo.'));
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      fetch(ENDPOINT + '/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: ref, conversion: r }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      }).then(function (resp) {
        if (resp.ok) { hecho(); return; }
        formErr.textContent = resp.status === 404
          ? 'Este enlace ya no es válido.'
          : 'No hemos podido guardarlo. Vuelve a intentarlo en unos minutos.';
        formErr.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Confirmar';
      }).catch(function () {
        formErr.textContent = 'No hemos podido conectar. Comprueba tu conexión e inténtalo de nuevo.';
        formErr.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Confirmar';
      });
    });
  }

  function initConfirmar() {
    var app = $('app');
    var q = new URLSearchParams(location.search);
    var ref = String(q.get('ref') || '');
    var r = String(q.get('r') || '');
    if (!REF_RE.test(ref) || (r !== 'venta' && r !== 'sin_venta')) {
      estadoVacio(app, 'Este enlace no es válido', 'Comprueba que lo has abierto tal cual venía en el correo.');
      return;
    }
    pintarConfirmar(app, ref, r);
  }

  function initGracias() {
    var params = new URLSearchParams(location.search);
    var slug = getSlug();
    if (params.get('demo') === '1') $('demo').classList.remove('hidden');
    if (!slug) return;
    loadConfig(slug).then(function (cfg) {
      aplicarTema(cfg);
      $('adv-head').appendChild(cabeceraAnunciante(cfg));
      $('quien').textContent = cfg.nombre_mostrado;
    }).catch(function () { /* mensaje genérico */ });
  }

  var page = document.body.getAttribute('data-page');
  if (page === 'lead') initLead();
  else if (page === 'gracias') initGracias();
  else if (page === 'confirmar') initConfirmar();
})();
