// Herramienta: Preventa (cola de llamadas a prospectos). La ven los roles 'admin' y 'preventa'; la cuenta
// preventa (equipo@candyads.es) SOLO ve esta pestaña.
//
// Datos (migración supabase/migrations/20261010000000_preventa_rol.sql):
//   - preventa_cola(): proyección de las empresas prospecto del CRM (contacto y notas de importación; nunca
//     pedidos, presupuestos ni importes). La cuenta preventa no puede leer crm_datos.
//   - crm_preventa: estado de preventa por empresa, tabla aparte del bloque del CRM (no provoca conflictos de
//     versión con el CRM abierto). Se escribe solo con preventa_registrar / preventa_deshacer, que validan
//     todo en la base de datos y guardan quién registró cada resultado.
// Todo se pinta con textContent.
(function () {
  'use strict';

  var RESULTADOS = {
    no_contesta:   { txt: 'No contesta',     ico: '📵', color: '#64748b' },
    volver:        { txt: 'Volver a llamar', ico: '🔁', color: '#b45309', fecha: true },
    interesado:    { txt: 'Interesado',      ico: '👍', color: '#047857' },
    cita:          { txt: 'Cita',            ico: '📅', color: '#7C3AED', fecha: true },
    no_interesado: { txt: 'No interesado',   ico: '✋', color: '#b91c1c' },
    erroneo:       { txt: 'Dato erróneo',    ico: '⚠️', color: '#9333ea' }
  };
  var ESTADOS = {
    pendiente: 'Sin llamar', no_contesta: 'No contesta', volver: 'Volver a llamar', interesado: 'Interesado',
    cita: 'Cita', no_interesado: 'No interesado', erroneo: 'Dato erróneo', sin_respuesta: 'Sin respuesta (5 intentos)'
  };
  var EN_COLA = { pendiente: 1, no_contesta: 1, volver: 1 };
  var POR_PAGINA = 30;

  // Se mantienen entre visitas a la pestaña durante la sesión.
  var filtro = { texto: '', sector: '', municipio: '', estado: 'cola' };
  var operador = '';
  try { operador = localStorage.getItem('pv_operador') || ''; } catch (e) { /* sin almacenamiento */ }

  function hoyISO(dias) {
    var d = new Date();
    if (dias) {
      d.setDate(d.getDate() + dias);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); // siguiente laborable
    }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function fechaCorta(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function fechaHora(ts) {
    var d = new Date(ts);
    return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  // Misma consulta que el botón «BUSCAR EN GOOGLE» del CRM (consultaGoogle en docs/crm/app.js): nombre +
  // municipio + provincia (si no es igual al municipio) + sector (salvo «Otros»). No escribe nada.
  function urlGoogle(c) {
    var t = function (v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); };
    var nombre = t(c.nombre), municipio = t(c.municipio), provincia = t(c.provincia), sector = t(c.sector);
    if (provincia && norm(provincia) === norm(municipio)) provincia = '';
    if (norm(sector) === 'otros') sector = '';
    var partes = [nombre, municipio, provincia, sector].filter(Boolean);
    return nombre ? 'https://www.google.com/search?q=' + encodeURIComponent(partes.join(' ')).replace(/%20/g, '+') : '';
  }

  var CAMPOS = [['contacto', 'Persona de contacto', 'text'], ['telefono', 'Móvil / directo', 'tel'],
                ['telefonoFijo', 'Teléfono fijo', 'tel'], ['email', 'Email', 'email']];

  function montar(cont, ctx) {
    var el = ctx.el;
    var empresas = [];      // de preventa_cola()
    var estados = {};       // cliente_id → fila de crm_preventa
    var mostrar = POR_PAGINA;
    var abiertos = {};      // historial desplegado por empresa
    var editando = {};      // formulario «Corregir datos» abierto por empresa

    function h(tag, cls, text, attrs) {
      var e = el(tag, cls, text);
      if (attrs) Object.keys(attrs).forEach(function (k) {
        if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]);
      });
      return e;
    }

    cont.appendChild(h('h2', 'p', 'Preventa'));
    var aviso = h('div', 'p-err'); aviso.style.display = 'none';
    var resumen = h('div', 'pv-resumen');
    var barra = h('div', 'pv-barra');
    var cuerpo = h('div', 'pv-lista', null);
    cont.append(aviso, resumen, barra, cuerpo);
    cuerpo.appendChild(h('p', 'p-note', 'Cargando la cola…'));

    function error(msg) { aviso.textContent = msg; aviso.style.display = 'block'; }

    function rpc(fn, cuerpoJson) {
      return ctx.api('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(cuerpoJson || {}) }).then(function (r) {
        if (r.status === 401) { ctx.sesionCaducada(); throw new Error('sesion'); }
        return r.json().catch(function () { return null; }).then(function (j) {
          if (r.status === 404 && j && j.code === 'PGRST202') throw new Error('Falta aplicar en Supabase las migraciones de Preventa (20261010000000_preventa_rol.sql y 20261010010000_preventa_correcciones.sql).');
          if (!r.ok) throw new Error(traducir(j && j.message));
          return j;
        });
      });
    }
    function traducir(m) {
      return ({
        'fecha no válida': 'Elige una fecha de hoy en adelante.',
        'empresa fuera de preventa': 'Esta empresa ya no está en preventa (es cliente en el CRM).',
        'sin permiso': 'Esta cuenta no tiene permiso para Preventa.',
        'sin resultados': 'No hay nada que deshacer.',
        'teléfono no válido': 'El teléfono no es válido: 9 cifras (o con prefijo +34).',
        'email no válido': 'El email no es válido.',
        'contacto demasiado largo': 'El nombre de contacto es demasiado largo (máx. 80).'
      })[m] || 'No se pudo guardar. Inténtalo de nuevo.';
    }

    function cargar() {
      Promise.all([
        rpc('preventa_cola'),
        ctx.api('/rest/v1/crm_preventa?select=*').then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); throw new Error('sesion'); }
          if (r.status === 404) throw new Error('Falta aplicar en Supabase las migraciones de Preventa (20261010000000_preventa_rol.sql y 20261010010000_preventa_correcciones.sql).');
          if (!r.ok) throw new Error('No se pudieron leer los resultados de preventa.');
          return r.json();
        })
      ]).then(function (res) {
        empresas = Array.isArray(res[0]) ? res[0] : [];
        estados = {};
        (res[1] || []).forEach(function (f) { estados[f.cliente_id] = f; });
        montarBarra();
        pintar();
      }).catch(function (e) {
        if (e.message === 'sesion') return;
        cuerpo.textContent = '';
        error(e.message);
      });
    }

    function estadoDe(c) { var f = estados[c.id]; return f ? f.estado : 'pendiente'; }

    function prioridad(c) {
      var e = estadoDe(c), f = estados[c.id] || {};
      if (e === 'volver') return (f.proxima || '') > hoyISO() ? 3 : 0;
      if (e === 'pendiente') return 1;
      if (e === 'no_contesta') return 2;
      return 4;
    }
    function ordenar(a, b) {
      var pa = prioridad(a), pb = prioridad(b);
      if (pa !== pb) return pa - pb;
      var A = estados[a.id] || {}, B = estados[b.id] || {};
      if (pa === 0 || pa === 3) return (A.proxima || '') < (B.proxima || '') ? -1 : 1;
      if (pa === 2 && A.intentos !== B.intentos) return A.intentos - B.intentos;
      if (pa === 2 || pa === 4) return (A.ultima || '') < (B.ultima || '') ? (pa === 2 ? -1 : 1) : (pa === 2 ? 1 : -1);
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    }
    function filtradas() {
      var t = norm(filtro.texto), hoy = hoyISO();
      return empresas.filter(function (c) {
        var e = estadoDe(c), f = estados[c.id] || {};
        if (filtro.estado === 'cola' && !EN_COLA[e]) return false;
        if (filtro.estado === 'hoy' && !(e === 'volver' && (f.proxima || '') <= hoy)) return false;
        if (ESTADOS[filtro.estado] && e !== filtro.estado) return false;
        if (filtro.sector && c.sector !== filtro.sector) return false;
        if (filtro.municipio && c.municipio !== filtro.municipio) return false;
        if (t && norm([c.nombre, c.contacto, c.telefono, c.telefonoFijo, c.municipio, c.email].join(' ')).indexOf(t) < 0) return false;
        return true;
      }).sort(ordenar);
    }

    // ── Barra de filtros ──
    function select(opciones, valor, alCambiar) {
      var s = h('select', 'pv-input');
      opciones.forEach(function (o) { var op = h('option', null, o[1]); op.value = o[0]; s.appendChild(op); });
      s.value = valor;
      if (s.value !== valor) s.value = '';
      s.addEventListener('change', function () { alCambiar(s.value); mostrar = POR_PAGINA; pintar(); });
      return s;
    }
    function montarBarra() {
      ctx.clear(barra);
      var buscar = h('input', 'pv-input pv-buscar', null, { type: 'search', placeholder: 'Buscar nombre, teléfono, contacto…' });
      buscar.value = filtro.texto;
      buscar.addEventListener('input', function () { filtro.texto = buscar.value; mostrar = POR_PAGINA; pintar(); });
      var est = [['cola', 'En cola (por llamar)'], ['hoy', 'Volver a llamar hoy'], ['todas', 'Todas']]
        .concat(Object.keys(ESTADOS).map(function (k) { return [k, ESTADOS[k]]; }));
      var sectores = uniq(empresas.map(function (c) { return c.sector; }));
      var muns = uniq(empresas.map(function (c) { return c.municipio; }));
      var op = h('input', 'pv-input pv-operador', null, { type: 'text', maxlength: '40', placeholder: 'Tu nombre (quién llama)',
        title: 'Se anota en cada llamada. Se recuerda en este navegador.' });
      op.value = operador;
      op.addEventListener('input', function () {
        operador = op.value.trim();
        try { localStorage.setItem('pv_operador', operador); } catch (e) { /* sin almacenamiento */ }
      });
      var exp = h('button', 'btn sec mini', '⬇ Excel (CSV)', { type: 'button' });
      exp.addEventListener('click', exportar);
      var rec = h('button', 'btn sec mini', '↻ Actualizar', { type: 'button', title: 'Vuelve a leer la cola (si otra persona está llamando a la vez)' });
      rec.addEventListener('click', cargar);
      barra.append(buscar,
        select(est, filtro.estado, function (v) { filtro.estado = v || 'cola'; }),
        select([['', 'Todos los sectores']].concat(sectores.map(function (v) { return [v, v]; })), filtro.sector, function (v) { filtro.sector = v; }),
        select([['', 'Todos los municipios']].concat(muns.map(function (v) { return [v, v]; })), filtro.municipio, function (v) { filtro.municipio = v; }),
        op, rec, exp);
    }
    function uniq(a) {
      return a.filter(function (v, i) { return v && a.indexOf(v) === i; }).sort(function (x, y) { return x.localeCompare(y, 'es'); });
    }

    function chip(txt, n, clase) {
      var c = h('span', 'pv-chip' + (clase ? ' ' + clase : ''), txt + ' ');
      c.appendChild(h('b', null, String(n)));
      return c;
    }
    function pintarResumen() {
      var hoy = hoyISO(), n = { cola: 0, hoy: 0, llamadas: 0, interesado: 0, cita: 0 };
      empresas.forEach(function (c) {
        var e = estadoDe(c), f = estados[c.id] || {};
        if (EN_COLA[e]) n.cola++;
        if (e === 'volver' && (f.proxima || '') <= hoy) n.hoy++;
        if (e === 'interesado') n.interesado++;
        if (e === 'cita') n.cita++;
        (f.resultados || []).forEach(function (r) { if (!r.anulado && ctx.ymd(new Date(r.ts)) === hoy) n.llamadas++; });
      });
      ctx.clear(resumen);
      resumen.append(chip('En cola', n.cola), chip('Rellamar hoy', n.hoy, n.hoy ? 'aviso' : ''),
        chip('Llamadas hoy', n.llamadas), chip('Interesados', n.interesado, 'ok'), chip('Citas', n.cita, 'cita'));
    }

    function telLink(t, ico) {
      var d = String(t || '').replace(/[^\d+]/g, '');
      if (!d) return null;
      return h('a', 'pv-tel', ico + ' ' + t, { href: 'tel:' + d });
    }

    function tarjeta(c) {
      var e = estadoDe(c), f = estados[c.id] || {};
      var vivos = (f.resultados || []).filter(function (r) { return !r.anulado; });
      var ult = vivos[vivos.length - 1];
      var vencido = e === 'volver' && (f.proxima || '') <= hoyISO();
      var t = h('div', 'pv-tarjeta' + (vencido ? ' vencido' : ''));

      var cab = h('div', 'pv-cab');
      var izq = h('div', 'pv-izq');
      izq.appendChild(h('div', 'pv-nombre', c.nombre || 'Sin nombre'));
      izq.appendChild(h('div', 'pv-meta', [c.sector, c.municipio, c.contacto ? '👤 ' + c.contacto : ''].filter(Boolean).join(' · ')));
      var der = h('div', 'pv-tels');
      [telLink(c.telefono, '📱'), telLink(c.telefonoFijo, '☎️')].forEach(function (a) { if (a) der.appendChild(a); });
      if (!c.telefono && !c.telefonoFijo) der.appendChild(h('span', 'pv-sin', 'Sin teléfono'));
      cab.append(izq, der);
      t.appendChild(cab);

      var extra = [c.email ? '✉️ ' + c.email : '', c.direccion ? '📍 ' + c.direccion + (c.cp ? ' (' + c.cp + ')' : '') : ''].filter(Boolean).join('   ');
      if (extra) t.appendChild(h('div', 'pv-meta', extra));
      (c.notas || []).forEach(function (n) {
        var txt = String(n).replace(/^.*?\(importado\)\s*/, '');
        var aviso = /AVISO/i.test(txt);
        t.appendChild(h('div', 'pv-nota' + (aviso ? ' aviso' : ''), (aviso ? '⚠️ ' : '') + txt));
      });

      var est = ESTADOS[e] + (f.intentos ? ' · ' + f.intentos + ' intento' + (f.intentos > 1 ? 's' : '') : '') +
        (f.proxima ? ' · ' + fechaCorta(f.proxima) : '') +
        (ult ? ' · última ' + fechaHora(ult.ts) + (ult.operador ? ' (' + ult.operador + ')' : '') : '');
      t.appendChild(h('div', 'pv-estado' + (vencido ? ' vencido' : ''), est));
      if (ult && ult.nota) t.appendChild(h('div', 'pv-meta', '«' + ult.nota + '»'));

      var acc = h('div', 'pv-acciones');
      var nota = h('input', 'pv-input pv-nota-in', null, { type: 'text', maxlength: '300', placeholder: 'Nota breve (opcional)' });
      var fecha = h('input', 'pv-input', null, { type: 'date', min: hoyISO(), title: 'Fecha para «Volver a llamar» o «Cita»' });
      fecha.value = hoyISO(2);
      acc.append(nota, fecha);
      Object.keys(RESULTADOS).forEach(function (k) {
        var R = RESULTADOS[k];
        var b = h('button', 'pv-res', R.ico + ' ' + R.txt, { type: 'button' });
        b.style.color = R.color; b.style.borderColor = R.color + '66'; b.style.background = R.color + '12';
        b.addEventListener('click', function () { registrar(c, k, fecha.value, nota.value, t); });
        acc.appendChild(b);
      });
      if (ult) {
        var d = h('button', 'pv-sec', '↶ Deshacer', { type: 'button', title: 'Anula el último resultado (queda registrado)' });
        d.addEventListener('click', function () { deshacer(c, t); });
        acc.appendChild(d);
      }
      var g = urlGoogle(c);
      if (g) {
        var gb = h('a', 'pv-sec pv-google', 'BUSCAR EN GOOGLE', { href: g, target: '_blank', rel: 'noopener noreferrer',
          title: 'Busca la empresa en Google con nombre, municipio, provincia y sector (no modifica nada)' });
        acc.appendChild(gb);
      }
      var eb = h('button', 'pv-sec', editando[c.id] ? 'Cerrar edición' : '✏️ Corregir datos', { type: 'button', title: 'Corrige contacto, teléfonos o email: queda en la ficha del CRM' });
      eb.addEventListener('click', function () { editando[c.id] = !editando[c.id]; t.replaceWith(tarjeta(c)); });
      acc.appendChild(eb);
      if ((f.resultados || []).length) {
        var hb = h('button', 'pv-sec', abiertos[c.id] ? 'Ocultar historial' : 'Historial (' + f.resultados.length + ')', { type: 'button' });
        hb.addEventListener('click', function () { abiertos[c.id] = !abiertos[c.id]; t.replaceWith(tarjeta(c)); });
        acc.appendChild(hb);
      }
      t.appendChild(acc);
      if (editando[c.id]) t.appendChild(formDatos(c, t));
      var pend = Object.keys(f.cambios || {}).length;
      if (pend) {
        var ult2 = Object.keys(f.cambios).map(function (k) { return f.cambios[k]; }).sort(function (a, b) { return a.ts < b.ts ? 1 : -1; })[0];
        t.appendChild(h('div', 'pv-meta', '✏️ Datos corregidos por preventa (' + fechaHora(ult2.ts) + (ult2.operador ? ', ' + ult2.operador : '') + ')'));
      }

      if (abiertos[c.id]) {
        var hist = h('div', 'pv-hist');
        (f.resultados || []).slice().reverse().forEach(function (r) {
          var R = RESULTADOS[r.resultado] || { txt: r.resultado };
          hist.appendChild(h('div', r.anulado ? 'anulado' : null,
            fechaHora(r.ts) + ' · ' + R.txt + (r.fecha ? ' → ' + fechaCorta(r.fecha) : '') + (r.nota ? ' · «' + r.nota + '»' : '') +
            ' · ' + (r.operador ? r.operador + ' / ' : '') + (r.quien || '') + (r.anulado ? ' · anulado por ' + (r.anulado_por || '') : '')));
        });
        t.appendChild(hist);
      }
      return t;
    }

    function formDatos(c, t) {
      var f = h('form', 'pv-form');
      var inputs = {};
      CAMPOS.forEach(function (d) {
        var lab = h('label', 'pv-campo');
        lab.appendChild(h('span', null, d[1]));
        var i = h('input', 'pv-input', null, { type: d[2], maxlength: d[0] === 'email' ? '120' : '80', autocomplete: 'off' });
        i.value = c[d[0]] || '';
        inputs[d[0]] = i;
        lab.appendChild(i);
        f.appendChild(lab);
      });
      var b = h('button', 'btn mini', 'Guardar datos', { type: 'submit' });
      f.appendChild(b);
      f.appendChild(h('div', 'p-note', 'Se guardan al momento aquí y pasan a la ficha del CRM la próxima vez que se abra, con una nota del dato anterior.'));
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var datos = {}, hay = false;
        CAMPOS.forEach(function (d) {
          var v = inputs[d[0]].value.trim();
          if (v !== (c[d[0]] || '')) { datos[d[0]] = v; hay = true; }
        });
        if (!hay) { editando[c.id] = false; t.replaceWith(tarjeta(c)); return; }
        aviso.style.display = 'none';
        bloquear(t, true);
        rpc('preventa_corregir', { p_cliente: c.id, p_datos: datos, p_operador: operador || '' })
          .then(function (fila) {
            estados[c.id] = fila;
            Object.keys(fila.cambios || {}).forEach(function (k) { c[k] = fila.cambios[k].valor; });
            editando[c.id] = false;
            pintar();
          })
          .catch(function (e) { if (e.message !== 'sesion') { error(e.message); bloquear(t, false); } });
      });
      return f;
    }

    function bloquear(t, si) { Array.prototype.forEach.call(t.querySelectorAll('button,input'), function (b) { b.disabled = si; }); }

    function registrar(c, resultado, fecha, nota, t) {
      var R = RESULTADOS[resultado];
      if (R.fecha && (!fecha || fecha < hoyISO())) { error('Elige la fecha (de hoy en adelante) para «' + R.txt + '».'); return; }
      aviso.style.display = 'none';
      bloquear(t, true);
      rpc('preventa_registrar', { p_cliente: c.id, p_resultado: resultado, p_fecha: R.fecha ? fecha : null,
        p_nota: nota || '', p_operador: operador || '' })
        .then(function (fila) { estados[c.id] = fila; pintar(); })
        .catch(function (e) { if (e.message !== 'sesion') { error(e.message); bloquear(t, false); } });
    }
    function deshacer(c, t) {
      aviso.style.display = 'none';
      bloquear(t, true);
      rpc('preventa_deshacer', { p_cliente: c.id })
        .then(function (fila) { estados[c.id] = fila; pintar(); })
        .catch(function (e) { if (e.message !== 'sesion') { error(e.message); bloquear(t, false); } });
    }

    function pintar() {
      if (!cuerpo.isConnected) return;
      pintarResumen();
      var lista = filtradas();
      var y = window.scrollY;
      ctx.clear(cuerpo);
      if (!lista.length) {
        cuerpo.appendChild(h('p', 'p-note', empresas.length
          ? (filtro.estado === 'cola' ? 'No queda nadie por llamar con estos filtros. 🎉' : 'Ninguna empresa con estos filtros.')
          : 'No hay prospectos en el CRM. Impórtalos desde CRM → ⚙️ Herramientas.'));
        return;
      }
      cuerpo.appendChild(h('div', 'p-note', lista.length + ' empresa' + (lista.length > 1 ? 's' : '')));
      lista.slice(0, mostrar).forEach(function (c) { cuerpo.appendChild(tarjeta(c)); });
      if (lista.length > mostrar) {
        var mas = h('button', 'btn sec mini', 'Mostrar ' + Math.min(POR_PAGINA, lista.length - mostrar) + ' más', { type: 'button' });
        mas.addEventListener('click', function () { mostrar += POR_PAGINA; pintar(); });
        cuerpo.appendChild(mas);
      }
      window.scrollTo(0, y);
    }

    function exportar() {
      var cab = ['Empresa', 'Sector', 'Municipio', 'Contacto', 'Movil', 'Fijo', 'Email', 'Estado', 'Intentos', 'Ultima llamada', 'Proxima fecha', 'Ultima nota', 'Quien'];
      var filas = empresas.slice().sort(ordenar).map(function (c) {
        var f = estados[c.id] || {}, vivos = (f.resultados || []).filter(function (r) { return !r.anulado; }), u = vivos[vivos.length - 1] || {};
        return [c.nombre, c.sector, c.municipio, c.contacto, c.telefono, c.telefonoFijo, c.email, ESTADOS[estadoDe(c)],
          f.intentos || 0, f.ultima ? fechaHora(f.ultima) : '', f.proxima || '', u.nota || '', u.operador || u.quien || ''];
      });
      var csv = [cab].concat(filas).map(function (r) {
        return r.map(function (v) {
          v = String(v == null ? '' : v);
          if (/^[=+\-@]/.test(v)) v = "'" + v;  // que Excel no lo interprete como fórmula
          return '"' + v.replace(/"/g, '""') + '"';
        }).join(';');
      }).join('\r\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'preventa_' + hoyISO() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    cargar();
  }

  PanelCore.registrar({ id: 'preventa', titulo: 'Preventa', roles: ['admin', 'preventa'], medio: true, montar: montar });
})();
