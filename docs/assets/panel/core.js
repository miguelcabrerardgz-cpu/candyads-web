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
          return api('/rest/v1/rpc/es_admin', { method: 'POST', body: '{}' });
        })
        .then(function (r) { return r.ok ? r.json() : false; })
        .then(function (esAdmin) {
          if (esAdmin !== true) { token = null; throw new Error('Esta cuenta no tiene acceso al panel.'); }
          shell();
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
  var ctx = { el: el, clear: clear, api: api, ymd: ymd, tabla: tabla, sesionCaducada: sesionCaducada, irA: function () {} };

  window.PanelCore = {
    registrar: function (h) { herramientas.push(h); },
    iniciar: function () { login(); }
  };

  // Las herramientas se registran al cargarse (scripts posteriores); se arranca cuando el documento termina.
  window.addEventListener('DOMContentLoaded', function () { window.PanelCore.iniciar(); });
})();
