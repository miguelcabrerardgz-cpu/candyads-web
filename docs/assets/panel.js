(function () {
  'use strict';
  // Valores PUBLICOS (la clave publishable esta pensada para ir en el navegador). Los datos los protege
  // RLS: solo un email de panel_admins puede leer leads_count. NUNCA poner aqui la secret key.
  var SUPABASE_URL = 'https://eceqcveqsbcfbmbaczed.supabase.co';
  var PUBLISHABLE_KEY = 'sb_publishable_oI-te1GMOiUJWOujDo2hUw_CaEg3NpK';

  var app = document.getElementById('app');
  var token = null; // solo en memoria: al cerrar o recargar la pestana hay que volver a entrar

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear() { while (app.firstChild) app.removeChild(app.firstChild); }

  function api(path, opts) {
    opts = opts || {};
    var h = { apikey: PUBLISHABLE_KEY };
    if (opts.body) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(SUPABASE_URL + path, { method: opts.method || 'GET', headers: h, body: opts.body, cache: 'no-store' });
  }

  function login(mensaje) {
    clear();
    app.appendChild(el('div', 'eyebrow', 'Uso interno'));
    app.appendChild(el('h1', null, 'Panel de leads'));
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
          return cargar();
        })
        .catch(function (e) { mostrar(e.message || 'No se pudo entrar.'); b.disabled = false; });
    });
    app.appendChild(form);
  }

  function cargar() {
    var desde = new Date(); desde.setDate(desde.getDate() - 400);
    return api('/rest/v1/leads_count?select=anunciante_slug,fecha,total&fecha=gte.' + ymd(desde) + '&order=fecha.desc&limit=5000')
      .then(function (r) {
        if (r.status === 401) { token = null; throw new Error('La sesión ha caducado. Vuelve a entrar.'); }
        if (!r.ok) throw new Error('No se pudieron leer los datos.');
        return r.json();
      })
      .then(pintar);
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

  function pintar(rows) {
    clear();
    var head = el('div', 'p-head');
    head.appendChild(el('h1', null, 'Leads'));
    var out = el('button', 'link', 'Salir');
    out.addEventListener('click', function () { token = null; login(); });
    head.appendChild(out);
    app.appendChild(head);

    if (!rows.length) {
      app.appendChild(el('p', 'lead', 'Sin datos todavía (o esta cuenta no tiene permiso de administrador).'));
      return;
    }
    var hoy = new Date(), mes = ymd(hoy).slice(0, 7);
    var mesAnt = ymd(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)).slice(0, 7);
    var por = {};
    rows.forEach(function (r) {
      var a = por[r.anunciante_slug] || (por[r.anunciante_slug] = { hoy: 0, mes: 0, ant: 0, tot: 0 });
      if (r.fecha === ymd(hoy)) a.hoy += r.total;
      if (r.fecha.slice(0, 7) === mes) a.mes += r.total;
      if (r.fecha.slice(0, 7) === mesAnt) a.ant += r.total;
      a.tot += r.total;
    });

    app.appendChild(el('h2', 'p', 'Resumen por anunciante'));
    app.appendChild(tabla(['Anunciante', 'Hoy', 'Este mes', 'Mes anterior', 'Total (13 meses)'],
      Object.keys(por).sort().map(function (s) { var a = por[s]; return [s, a.hoy, a.mes, a.ant, a.tot]; })));

    app.appendChild(el('h2', 'p', 'Detalle diario (últimos 30 registros)'));
    app.appendChild(tabla(['Fecha', 'Anunciante', 'Leads'],
      rows.slice(0, 30).map(function (r) { return [r.fecha, r.anunciante_slug, r.total]; })));
    app.appendChild(el('p', 'p-note', 'Solo contadores agregados: aquí no existe ningún dato personal de leads.'));
  }

  if (SUPABASE_URL.indexOf('REEMPLAZAR') !== -1) {
    clear();
    app.appendChild(el('p', 'lead', 'Panel sin configurar.'));
  } else {
    login();
  }
})();
