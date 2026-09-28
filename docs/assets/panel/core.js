// Panel interno de Candy Ads: acceso para el equipo. Este archivo solo contiene lo común (login, permisos,
// navegación por herramientas). Cada herramienta vive en su propio archivo y se registra con
// PanelCore.registrar(...). Para añadir una (p. ej. un CRM): crear assets/panel/<herramienta>.js, cargarlo en
// panel.html y llamar a registrar. Nada más.
(function () {
  'use strict';
  // Valores PUBLICOS (la clave publishable esta pensada para ir en el navegador). Los datos los protege
  // RLS: solo un email de panel_admins puede leer. NUNCA poner aqui la secret key.
  var SUPABASE_URL = 'https://eceqcveqsbcfbmbaczed.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_oI-te1GMOiUJWOujDo2hUw_CaEg3NpK';

  var app = document.getElementById('app');
  var token = null; // solo en memoria: al cerrar o recargar la pestana hay que volver a entrar
  var herramientas = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(nodo) { nodo = nodo || app; while (nodo.firstChild) nodo.removeChild(nodo.firstChild); }

  function api(path, opts) {
    opts = opts || {};
    var h = { apikey: PUBLISHABLE_KEY };
    // contentType permite subir archivos (Supabase Storage) sin forzar application/json.
    if (opts.body != null) h['Content-Type'] = opts.contentType || 'application/json';
    if (token) h.Authorization = 'Bearer ' + token;
    // headers: para cabeceras propias de Storage, p. ej. x-upsert al reemplazar un logo.
    if (opts.headers) { for (var k in opts.headers) h[k] = opts.headers[k]; }
    return fetch(SUPABASE_URL + path, { method: opts.method || 'GET', headers: h, body: opts.body, cache: 'no-store' });
  }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function tabla(cabeceras, filas) {
    var t = el('table', 'p'), tr = el('tr');
    cabeceras.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    t.appendChild(tr);
    filas.forEach(function (f) {
      var r = el('tr');
      f.forEach(function (v, i) { r.appendChild(el('td', i === 0 ? null : 'n', String(v))); });
      t.appendChild(r);
    });
    var w = el('div', 'tbl-scroll');
    w.appendChild(t);
    return w;
  }

  // Las herramientas llaman a esto cuando la API responde 401.
  function sesionCaducada() {
    token = null;
    login('La sesión ha caducado. Vuelve a entrar.');
  }

  function salir() { token = null; login(); }

  function rpcBool(fn) {
    return api('/rest/v1/rpc/' + fn, { method: 'POST', body: '{}' })
      .then(function (r) { return r.ok ? r.json() : false; })
      .then(function (v) { return v === true; });
  }

  function jsonDe(r) {
    return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
  }

  // QR del alta, generado aquí a partir de totp.uri con la misma librería del generador de QR (qrcode-lib.js,
  // alojada en el sitio). No se usa totp.qr_code: la API de Supabase lo devuelve como SVG en bruto, sin "data:"
  // delante (el prefijo lo añade supabase-js, que aquí no se usa), y puesto como src de una <img> sale roto.
  function qrDe(texto) {
    var qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    var n = qr.getModuleCount(), q = 4, t = n + q * 2, d = '';
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (qr.isDark(r, c)) {
          var ini = c;
          while (c < n && qr.isDark(r, c)) c++;
          d += 'M' + (ini + q) + ' ' + (r + q) + 'h' + (c - ini) + 'v1h-' + (c - ini) + 'z';
        } else c++;
      }
    }
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + t + ' ' + t);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Código QR para la app de autenticación');
    var fondo = document.createElementNS(NS, 'rect');
    fondo.setAttribute('width', t); fondo.setAttribute('height', t); fondo.setAttribute('fill', '#fff');
    var modulos = document.createElementNS(NS, 'path');
    modulos.setAttribute('d', d); modulos.setAttribute('fill', '#000');
    svg.append(fondo, modulos);
    return svg;
  }

  // Texto para el usuario según el error_code de Supabase Auth (el cuerpo de error es {code, error_code, msg}).
  function errorMfa(r, alta) {
    var c = r.j && r.j.error_code;
    if (r.status === 429 || c === 'over_request_rate_limit') return 'Demasiados intentos seguidos. Espera 5 minutos y vuelve a probar.';
    if (c === 'mfa_verification_failed') {
      return alta
        ? 'Código incorrecto. Usa la entrada que acabas de añadir con ESTE código QR: si en la app tienes otras de ' +
          '«Candy Ads» de intentos anteriores, bórralas, ya no sirven. Comprueba también que la hora del móvil está en automático.'
        : 'Código incorrecto o caducado. Escribe el que muestre ahora la app (cambia cada 30 segundos).';
    }
    return 'No se pudo verificar el código (' + (c || r.status) + '). Vuelve a intentarlo.';
  }

  // Segundo factor (TOTP) con el MFA nativo de Supabase Auth. Tras la contraseña la sesión es aal1 y la
  // base de datos no deja leer nada (es_admin() exige aal2): este paso la sube a aal2.
  // Primera vez: se inscribe la app (QR). Después: solo se pide el código.
  function pasoMfa() {
    return api('/auth/v1/user')
      .then(function (r) {
        if (!r.ok) throw new Error('No se pudo comprobar la verificación en dos pasos.');
        return r.json();
      })
      .then(function (u) {
        var totp = (u.factors || []).filter(function (f) { return f.factor_type === 'totp'; });
        var verificado = totp.filter(function (f) { return f.status === 'verified'; })[0];
        if (verificado) { pantallaCodigo(verificado.id, null); return; }
        // Inscripciones que se quedaron a medias (QR mostrado pero nunca confirmado): se borran antes de
        // empezar otra, para no acumular factores sin verificar.
        return Promise.all(totp.map(function (f) { return api('/auth/v1/factors/' + f.id, { method: 'DELETE' }); }))
          .then(inscribir);
      });
  }

  function inscribir() {
    return api('/auth/v1/factors', {
      method: 'POST',
      body: JSON.stringify({ factor_type: 'totp', issuer: 'Candy Ads', friendly_name: 'Panel Candy Ads ' + new Date().toISOString() })
    }).then(jsonDe).then(function (r) {
      if (!r.ok || !r.j.id || !r.j.totp) throw new Error('No se pudo iniciar la verificación en dos pasos.');
      pantallaCodigo(r.j.id, r.j.totp);
    });
  }

  // Reto nuevo + verificación. Devuelve el access_token aal2.
  function verificar(factorId, codigo, alta, reintento) {
    return api('/auth/v1/factors/' + factorId + '/challenge', { method: 'POST', body: '{}' })
      .then(jsonDe)
      .then(function (r) {
        if (!r.ok || !r.j.id) throw new Error(errorMfa(r, alta));
        return api('/auth/v1/factors/' + factorId + '/verify', {
          method: 'POST', body: JSON.stringify({ challenge_id: r.j.id, code: codigo })
        }).then(jsonDe);
      })
      .then(function (r) {
        // Supabase exige que el reto y la verificación lleguen desde la misma IP. Si la conexión cambia de IP justo
        // entre las dos llamadas (pasa en redes móviles), se repite una vez con un reto nuevo.
        var c = r.j && r.j.error_code;
        if (!r.ok && !reintento && (c === 'mfa_ip_address_mismatch' || c === 'mfa_challenge_expired')) {
          return verificar(factorId, codigo, alta, true);
        }
        if (!r.ok || !r.j.access_token) throw new Error(errorMfa(r, alta));
        return r.j.access_token;
      });
  }

  // totp != null: alta del factor (se muestra el QR). totp == null: login normal, solo el código.
  function pantallaCodigo(factorId, totp) {
    clear();
    app.appendChild(el('div', 'eyebrow', 'Uso interno'));
    app.appendChild(el('h1', null, totp ? 'Activa la verificación en dos pasos' : 'Verificación en dos pasos'));
    if (totp) {
      // Cada alta genera una clave nueva e invalida las anteriores: si el usuario ya añadió una entrada en un intento
      // previo (o recarga la página a medias), los códigos de esa entrada vieja no valen. Por eso el paso 1.
      var pasos = el('ol', 'mfa-pasos');
      pasos.append(
        el('li', null, 'Abre Google Authenticator (u otra app de autenticación). Si ya tienes alguna entrada «Candy Ads» ' +
          'de un intento anterior, bórrala: ya no sirve.'),
        el('li', null, 'Pulsa «+» → «Escanear un código QR» y escanea este código:'));
      app.appendChild(pasos);
      var qr = el('div', 'mfa-qr');
      qr.appendChild(qrDe(totp.uri));
      app.appendChild(qr);
      var manual = el('p', 'p-note', '¿No puedes escanearlo? En la app elige «Introducir una clave de configuración», ' +
        'pon de nombre Candy Ads, tipo «Basada en el tiempo», y esta clave: ');
      manual.appendChild(el('code', 'mfa-clave', totp.secret.replace(/(.{4})/g, '$1 ').trim()));
      app.appendChild(manual);
      var pasos3 = el('ol', 'mfa-pasos');
      pasos3.start = 3;
      pasos3.appendChild(el('li', null, 'Escribe abajo el código de 6 dígitos que aparece en esa entrada nueva.'));
      app.appendChild(pasos3);
      app.appendChild(el('p', 'p-note mfa-aviso', 'No recargues ni cierres esta página hasta terminar: si lo haces, este código QR ' +
        'deja de valer y saldrá otro distinto.'));
    } else {
      app.appendChild(el('p', 'lead', 'Escribe el código de 6 dígitos que muestra tu app de autenticación.'));
    }

    var form = el('form');
    var err = el('div', 'p-err'); err.style.display = 'none';
    var f = el('div', 'field');
    var i = el('input');
    // Sin maxLength 6: Google Authenticator muestra el código como "123 456" y al pegarlo se cortaría.
    i.type = 'text'; i.inputMode = 'numeric'; i.autocomplete = 'one-time-code'; i.maxLength = 12; i.required = true;
    f.append(el('label', 'lbl', 'Código'), i);
    var b = el('button', 'btn', totp ? 'Activar y entrar' : 'Entrar'); b.type = 'submit';
    form.append(err, f, b);
    var out = el('button', 'link', 'Salir'); out.type = 'button';
    out.addEventListener('click', salir);
    app.append(form, out);
    i.focus();

    function mostrar(m) { err.textContent = m; err.style.display = 'block'; }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var codigo = i.value.replace(/\D+/g, '');
      if (!/^[0-9]{6}$/.test(codigo)) { mostrar('El código tiene 6 dígitos.'); return; }
      b.disabled = true; err.style.display = 'none';
      // Un reto nuevo por intento: si el código anterior falló, no se reutiliza su reto.
      verificar(factorId, codigo, !!totp, false)
        .then(function (aal2) {
          token = aal2; // sesión aal2: a partir de aquí la RLS deja leer
          return rpcBool('es_admin');
        })
        .then(function (esAdmin) {
          if (!esAdmin) { token = null; throw new Error('Esta cuenta no tiene acceso al panel.'); }
          shell();
        })
        .catch(function (e) { mostrar(e.message || 'No se pudo verificar.'); b.disabled = false; i.value = ''; i.focus(); });
    });
  }

  function login(mensaje) {
    clear();
    app.appendChild(el('div', 'eyebrow', 'Uso interno'));
    app.appendChild(el('h1', null, 'Panel del equipo'));
    var form = el('form');
    var err = el('div', 'p-err');
    err.style.display = 'none';
    var f1 = el('div', 'field'), f2 = el('div', 'field');
    var l1 = el('label', 'lbl', 'Email'), l2 = el('label', 'lbl', 'Contraseña');
    var i1 = el('input'); i1.type = 'email'; i1.autocomplete = 'username'; i1.required = true;
    var i2 = el('input'); i2.type = 'password'; i2.autocomplete = 'current-password'; i2.required = true;
    f1.append(l1, i1); f2.append(l2, i2);
    var b = el('button', 'btn', 'Entrar'); b.type = 'submit';
    form.append(err, f1, f2, b);
    function mostrar(m) { err.textContent = m; err.style.display = 'block'; }
    if (mensaje) mostrar(mensaje);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      b.disabled = true; err.style.display = 'none';
      api('/auth/v1/token?grant_type=password', {
        method: 'POST', body: JSON.stringify({ email: i1.value.trim(), password: i2.value })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok || !r.j.access_token) throw new Error('Email o contraseña incorrectos.');
          token = r.j.access_token; i2.value = '';
          // Solo comprueba que el email está en panel_admins; los datos siguen cerrados hasta el segundo factor.
          return rpcBool('es_admin_email');
        })
        .then(function (autorizado) {
          if (!autorizado) { token = null; throw new Error('Esta cuenta no tiene acceso al panel.'); }
          return pasoMfa();
        })
        .catch(function (e) { mostrar(e.message || 'No se pudo entrar.'); b.disabled = false; });
    });
    app.appendChild(form);
  }

  // Estructura: barra con las herramientas registradas + zona de contenido.
  function shell() {
    clear();
    var barra = el('div', 'p-tabs');
    var cont = el('div', 'p-cont');
    var botones = {};
    herramientas.forEach(function (h) {
      var b = el('button', 'p-tab', h.titulo);
      b.type = 'button';
      b.addEventListener('click', function () { abrir(h.id); });
      botones[h.id] = b;
      barra.appendChild(b);
    });
    var out = el('button', 'link p-salir', 'Salir');
    out.addEventListener('click', salir);
    barra.appendChild(out);
    app.append(barra, cont);

    function abrir(id, param) {
      var h = herramientas.filter(function (x) { return x.id === id; })[0] || herramientas[0];
      if (!h) return;
      Object.keys(botones).forEach(function (k) { botones[k].classList.toggle('activa', k === h.id); });
      try { history.replaceState(null, '', '#' + h.id); } catch (e) { /* sin historial: da igual */ }
      clear(cont);
      h.montar(cont, ctx, param);
    }
    ctx.irA = abrir;
    abrir((location.hash || '').slice(1));
  }

  // ctx.irA se asigna en shell() (necesita el "abrir" de la sesión actual); antes del login es un no-op.
  var ctx = {
    el: el, clear: clear, api: api, ymd: ymd, tabla: tabla, sesionCaducada: sesionCaducada, irA: function () {},
    // Pública ya (va embebida en este mismo archivo): sirve para construir URLs públicas de Storage.
    supabaseUrl: SUPABASE_URL
  };

  window.PanelCore = {
    registrar: function (h) { herramientas.push(h); },
    iniciar: function () { login(); }
  };

  // Las herramientas se registran al cargarse (scripts posteriores); se arranca cuando el documento termina.
  window.addEventListener('DOMContentLoaded', function () { window.PanelCore.iniciar(); });
})();
