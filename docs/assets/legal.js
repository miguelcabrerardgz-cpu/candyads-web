// Páginas legales: sin JavaScript en línea (CSP script-src 'self').
'use strict';
if (window.top !== window.self) {
  try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = 'none'; }
}
document.addEventListener('DOMContentLoaded', function () {
  var b = document.getElementById('reset-cookies');
  if (b) b.addEventListener('click', function () {
    try { localStorage.removeItem('ca_ck'); } catch (e) { /* almacenamiento bloqueado */ }
    location.reload();
  });
});
