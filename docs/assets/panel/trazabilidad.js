// Herramienta: trazabilidad de leads (solo lectura). Muestra contadores y, por día, cada lead con su hora
// exacta, referencia y estado. No existe ningún dato personal de leads en la base de datos.
(function () {
  'use strict';

  var hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var diaMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
  var ETQ = { enviado: 'Enviado', error: 'Error de envío', pendiente: 'Sin confirmar' };
  var CONV = { pendiente: '—', venta: '✅ Venta', sin_venta: '❌ Sin venta' };

  function sumaDias(f, n) {
    var d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function montar(cont, ctx) {
    var el = ctx.el, ymd = ctx.ymd, tabla = ctx.tabla;
    var resumen = [];

    function limpiar() { ctx.clear(cont); }

    function cargar() {
      limpiar();
      cont.appendChild(el('p', 'lead', 'Cargando…'));
      var desde = new Date(); desde.setDate(desde.getDate() - 400);
      ctx.api('/rest/v1/leads_count?select=anunciante_slug,fecha,total&fecha=gte.' + ymd(desde) + '&order=fecha.desc&limit=5000')
        .then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('No se pudieron leer los datos.');
          return r.json();
        })
        .then(function (rows) { if (rows) { resumen = rows; pintar(rows); } })
        .catch(function (e) { limpiar(); cont.appendChild(el('div', 'p-err', e.message)); });
    }

    function pintar(rows) {
      limpiar();
      cont.appendChild(el('h1', 'p-h1', 'Trazabilidad de leads'));
      if (!rows.length) {
        cont.appendChild(el('p', 'lead', 'Sin datos todavía.'));
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

      cont.appendChild(el('h2', 'p', 'Resumen por anunciante'));
      cont.appendChild(tabla(['Anunciante', 'Hoy', 'Este mes', 'Mes anterior', 'Total (13 meses)'],
        Object.keys(por).sort().map(function (s) { var a = por[s]; return [s, a.hoy, a.mes, a.ant, a.tot]; })));

      cont.appendChild(el('h2', 'p', 'Detalle diario (pulsa un día para ver cada lead)'));
      var w = tabla(['Fecha', 'Anunciante', 'Leads'],
        rows.slice(0, 30).map(function (r) { return [r.fecha, r.anunciante_slug, r.total]; }));
      Array.prototype.forEach.call(w.querySelectorAll('tr'), function (tr, i) {
        if (i === 0) return;
        tr.className = 'clic';
        tr.addEventListener('click', function () { verDia(rows[i - 1].fecha, rows[i - 1].anunciante_slug); });
      });
      cont.appendChild(w);
      var ir = el('button', 'btn', 'Ver el día de hoy');
      ir.addEventListener('click', function () { verDia(ymd(new Date()), ''); });
      cont.appendChild(ir);
    }

    // Vista de un día (hora de Madrid): un lead por fila, con hora exacta, referencia y estado.
    function verDia(fecha, slug) {
      ctx.api('/rest/v1/leads_registro?select=ref,anunciante_slug,recibido_at,estado,conversion&recibido_at=gte.' + sumaDias(fecha, -1) +
          'T00:00:00Z&recibido_at=lt.' + sumaDias(fecha, 2) + 'T00:00:00Z&order=recibido_at.asc&limit=1000')
        .then(function (r) {
          if (r.status === 401) { ctx.sesionCaducada(); return null; }
          if (!r.ok) throw new Error('No se pudieron leer los leads.');
          return r.json();
        })
        .then(function (rows) {
          if (!rows) return;
          pintarDia(fecha, slug, rows.filter(function (r) {
            return diaMadrid.format(new Date(r.recibido_at)) === fecha && (!slug || r.anunciante_slug === slug);
          }));
        })
        .catch(function (e) {
          limpiar(); cont.appendChild(el('div', 'p-err', e.message));
          var b = el('button', 'link', 'Volver'); b.addEventListener('click', function () { pintar(resumen); });
          cont.appendChild(b);
        });
    }

    function pintarDia(fecha, slug, rows) {
      limpiar();
      var head = el('div', 'p-head');
      var v = el('button', 'link', '← Resumen');
      v.addEventListener('click', function () { pintar(resumen); });
      head.appendChild(v);
      head.appendChild(el('div', 'eyebrow', slug || 'Todos los anunciantes'));
      cont.appendChild(head);

      var nav = el('div', 'p-nav');
      var ant = el('button', 'btn nav', '‹'), sig = el('button', 'btn nav', '›');
      var inp = el('input'); inp.type = 'date'; inp.value = fecha;
      ant.addEventListener('click', function () { verDia(sumaDias(fecha, -1), slug); });
      sig.addEventListener('click', function () { verDia(sumaDias(fecha, 1), slug); });
      inp.addEventListener('change', function () { if (inp.value) verDia(inp.value, slug); });
      nav.append(ant, inp, sig);
      cont.appendChild(nav);

      var c = { enviado: 0, error: 0, pendiente: 0 };
      var conv = { pendiente: 0, venta: 0, sin_venta: 0 };
      rows.forEach(function (r) { c[r.estado] += 1; conv[r.conversion] += 1; });
      cont.appendChild(el('p', 'p-cifras',
        c.enviado + ' enviados' + (c.error ? ' · ' + c.error + ' con error' : '') + (c.pendiente ? ' · ' + c.pendiente + ' sin confirmar' : '') +
        (conv.venta || conv.sin_venta ? ' · ' + conv.venta + ' venta / ' + conv.sin_venta + ' sin venta' : '')));
      if (c.error || c.pendiente) cont.appendChild(el('div', 'p-err', 'Hay leads que no constan como enviados. Revísalos antes de dar el día por bueno.'));

      if (!rows.length) { cont.appendChild(el('p', 'lead', 'Sin leads este día.')); return; }
      cont.appendChild(tabla(['Hora', 'Ref.', 'Anunciante', 'Estado', 'Conversión'],
        rows.map(function (r) { return [hora.format(new Date(r.recibido_at)), r.ref.slice(0, 8).toUpperCase(), r.anunciante_slug, ETQ[r.estado], CONV[r.conversion]]; })));
      cont.appendChild(el('p', 'p-note', 'Hora de Madrid. La referencia aparece también en el correo que recibe el anunciante. “Enviado” significa que Amazon SES aceptó el mensaje. La conversión la marca el propio anunciante desde el correo, con un clic.'));
    }

    cargar();
  }

  PanelCore.registrar({ id: 'trazabilidad', titulo: 'Trazabilidad', montar: montar });
})();
