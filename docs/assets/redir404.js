// GitHub Pages no tiene rewrites: /lead/<slug> cae en 404.html y se reenvía al formulario.
// Solo se acepta un slug con el mismo patrón que valida la Lambda (sin redirecciones abiertas).
(function () {
  'use strict';
  var m = location.pathname.match(/^\/lead\/([a-z0-9][a-z0-9-]{0,60})\/?$/i);
  if (m) location.replace('/lead.html?s=' + encodeURIComponent(m[1].toLowerCase()));
})();
