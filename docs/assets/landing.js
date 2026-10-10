// Candy Ads · landing (candyads.es). Fuera del HTML para que la página pueda llevar una CSP con
// script-src 'self' (sin JavaScript en línea ni manejadores onclick/onmouseover).
'use strict';

// ── No mostrar la web dentro de un marco ajeno (clickjacking) ─────────────────────────────────────────
// GitHub Pages no permite la cabecera X-Frame-Options ni frame-ancestors (en <meta> no tiene efecto).
if (window.top !== window.self) {
  try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = 'none'; }
}

// ── Cookie banner ──────────────────────────────────────────────────────────
(function(){
  var banner = document.getElementById('cookie-banner');
  var visto = null;
  try { visto = localStorage.getItem('ca_ck'); } catch (e) { /* almacenamiento bloqueado: se muestra el banner */ }
  if (!visto) banner.style.display = 'block';
  function elegir(v){ try { localStorage.setItem('ca_ck', v); } catch (e) {} banner.style.display = 'none'; }
  document.getElementById('cookie-reject').addEventListener('click', function(){ elegir('rejected'); });
  document.getElementById('cookie-accept').addEventListener('click', function(){ elegir('accepted'); });
})();

// ── AJAX form — no page redirect, inline success ───────────────────────────
(function(){
  // Backend propio (misma Lambda + SES que el formulario de leads), no Formspree: sin depender de un
  // proveedor adicional. En localhost usa el backend de pruebas del mismo origen.
  var ENDPOINT_CONTACTO = location.hostname === 'localhost' ? '/api' : 'https://rx4ydbbhvlm4zuyo3p5ci3an3q0filte.lambda-url.eu-west-1.on.aws';
  var t0 = Date.now();
  const form = document.getElementById('contact-form');
  const ok   = document.getElementById('form-ok');
  const btn  = form ? form.querySelector('.btn-submit') : null;
  if(!form) return;
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if (form.elements.web_site.value) { form.style.display='none'; ok.style.display='block'; return; }
    btn.textContent = 'Enviando...';
    btn.disabled = true;
    btn.style.opacity = '.6';
    const datos = {
      nombre: form.elements.nombre.value.trim(),
      empresa: form.elements.empresa.value.trim(),
      tipo: form.elements.tipo.value,
      telefono: form.elements.telefono.value.trim(),
      email: form.elements.email.value.trim(),
      mensaje: form.elements.mensaje.value.trim()
    };
    try{
      const res = await fetch(ENDPOINT_CONTACTO + '/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos: datos, privacidad: form.elements.privacidad.checked, t: Date.now() - t0 }),
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      if(res.ok){
        form.style.display='none';
        ok.style.display='block';
      } else {
        const data = await res.json().catch(function(){ return {}; });
        const code = (data && data.code) || '';
        let msg = 'No hemos podido enviar tu mensaje. Inténtalo de nuevo en unos minutos.';
        if (code === 'privacidad') msg = 'Tienes que aceptar la política de privacidad para enviar el mensaje.';
        else if (code.indexOf('datos_') === 0) msg = 'Revisa los datos del formulario e inténtalo de nuevo.';
        else if (res.status === 429) msg = 'Has enviado demasiados mensajes. Inténtalo de nuevo en unos minutos.';
        alert(msg);
        btn.textContent = 'Enviar mensaje';
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    } catch(err){
      alert('Error de conexión. Por favor, escríbenos directamente a equipo@candyads.es');
      btn.textContent = 'Enviar mensaje';
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  });
})();

// ── Smooth anchor nav ──────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    if(!id) return;
    const el = document.getElementById(id);
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
  });
});

// ── Mobile menu ────────────────────────────────────────────────────────────
(function(){
  const btn  = document.getElementById('menu-btn');
  const menu = document.getElementById('mobile-menu');
  if(!btn || !menu) return;
  btn.addEventListener('click', ()=>{
    const open = menu.style.display === 'block';
    menu.style.display = open ? 'none' : 'block';
    btn.innerHTML = open ? '&#9776;' : '&#10005;';
  });
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    menu.style.display='none';
    btn.innerHTML='&#9776;';
  }));
})();

// ── Back to top ────────────────────────────────────────────────────────────
(function(){
  const btn = document.getElementById('back-top');
  if(!btn) return;
  window.addEventListener('scroll',()=>{
    btn.style.opacity = window.scrollY > 600 ? '1' : '0';
    btn.style.pointerEvents = window.scrollY > 600 ? 'auto' : 'none';
  });
  btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
})();
