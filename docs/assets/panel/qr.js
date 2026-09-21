// Herramienta: generador de QR para los sobres. Todo se genera en el navegador (librería qrcode-generator, MIT,
// alojada en este mismo sitio): no se envía nada a ningún servidor.
(function () {
  'use strict';
  var BASE = 'https://candyads.es/lead/';
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

  function svgDe(qr, px) {
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
    var tam = px ? ' width="' + px + '" height="' + px + '"' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '"' + tam + ' shape-rendering="crispEdges">' +
      '<rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  function descargar(blob, nombre) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function montar(cont, ctx) {
    var el = ctx.el;
    var actual = null;

    cont.appendChild(el('h1', 'p-h1', 'Generador de QR'));
    cont.appendChild(el('p', 'lead', 'Crea el QR de un anunciante para imprimirlo en los sobres. Se genera aquí mismo, sin enviar nada a ningún sitio.'));

    var f1 = el('div', 'field');
    f1.appendChild(el('label', 'lbl', 'Identificador del anunciante'));
    var fila = el('div', 'qr-fila');
    fila.appendChild(el('span', null, BASE));
    var slug = el('input'); slug.type = 'text'; slug.value = 'lacasa-piloto'; slug.autocomplete = 'off'; slug.spellcheck = false;
    fila.appendChild(slug);
    f1.appendChild(fila);
    var err = el('div', 'qr-err');
    f1.appendChild(err);

    var f2 = el('div', 'field');
    f2.appendChild(el('label', 'lbl', 'Corrección de errores'));
    var nivel = el('select');
    [['Q', 'Q · recomendado para sobres (aguanta pliegues y manchas)'], ['M', 'M · más simple, para pantallas'], ['H', 'H · máxima, QR más denso']]
      .forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; nivel.appendChild(op); });
    f2.appendChild(nivel);

    var vista = el('div', 'qr-vista');
    var urlTxt = el('div', 'qr-url');
    var botones = el('div', 'qr-botones');
    var bSvg = el('button', 'btn', 'Descargar SVG (imprenta)'); bSvg.type = 'button';
    var bPng = el('button', 'btn sec', 'Descargar PNG'); bPng.type = 'button';
    botones.append(bSvg, bPng);
    var nota = el('p', 'p-note', 'Antes de imprimir: escanea el QR con un móvil y comprueba que abre el formulario del anunciante correcto. ' +
      'El anunciante debe existir en docs/data/anunciantes/<identificador>.json y tener su email de destino en Supabase. ' +
      'Deja margen blanco alrededor al imprimir y un tamaño mínimo de 2 cm de lado.');
    cont.append(f1, f2, vista, urlTxt, botones, nota);

    function refrescar() {
      var s = slug.value.trim();
      var ok = SLUG_RE.test(s);
      err.textContent = ok || !s ? '' : 'Solo minúsculas, números y guiones (máx. 61 caracteres), sin empezar por guion.';
      bSvg.disabled = bPng.disabled = !ok;
      ctx.clear(vista);
      if (!ok) { urlTxt.textContent = ''; actual = null; return; }
      var url = BASE + s;
      var qr = qrcode(0, nivel.value);
      qr.addData(url);
      qr.make();
      actual = { slug: s, qr: qr };
      var doc = new DOMParser().parseFromString(svgDe(qr), 'image/svg+xml');
      vista.appendChild(document.importNode(doc.documentElement, true));
      urlTxt.textContent = url;
    }

    bSvg.addEventListener('click', function () {
      if (!actual) return;
      descargar(new Blob([svgDe(actual.qr, 1000)], { type: 'image/svg+xml' }), 'qr-' + actual.slug + '.svg');
    });
    bPng.addEventListener('click', function () {
      if (!actual) return;
      var n = actual.qr.getModuleCount(), t = n + 8, esc = Math.max(1, Math.floor(1200 / t));
      var cv = document.createElement('canvas');
      cv.width = cv.height = t * esc;
      var cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
        if (actual.qr.isDark(r, c)) cx.fillRect((c + 4) * esc, (r + 4) * esc, esc, esc);
      var nombre = actual.slug;
      cv.toBlob(function (b) { descargar(b, 'qr-' + nombre + '.png'); }, 'image/png');
    });
    slug.addEventListener('input', refrescar);
    nivel.addEventListener('change', refrescar);
    refrescar();
  }

  PanelCore.registrar({ id: 'qr', titulo: 'Generador de QR', montar: montar });
})();
