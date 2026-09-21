# Candy Ads — sitio web

Proyecto **independiente**, sin relación con el CRM Rocafer (otro proyecto del mismo equipo, en otra carpeta/repositorio).

## Qué es

Landing page de Candy Ads: venta de espacios publicitarios en sobres de azúcar monodosis para bares y cafeterías (Sevilla). Sitio estático, sin build system — HTML plano servido tal cual.

- Titular: Miguel Cabrera Rodríguez
- Dominio: candyads.es (registrado en IONOS, DNS en Cloudflare en modo "DNS only")
- Contacto: miguelcabrerardgz@gmail.com · 634 237 322

## Hosting

- GitHub Pages, repo público `candyads-web` (usuario `miguelcabrerardgz-cpu`), rama `main`, carpeta `/docs`.
- Se migró desde Cloudflare Pages porque las IPs de Cloudflare se bloquean en España durante partidos (LaLiga). El registro DNS NO debe volver a ir con proxy (nube naranja).
- El repo es público: nunca commitear claves, tokens ni datos personales.
- Rollback: el proyecto Cloudflare Pages `candyads` sigue existiendo (rama de producción `main`).

## Estructura

- `docs/` — lo único que se publica
  - `index.html` — landing principal (una sola página, imágenes embebidas en base64)
  - `aviso-legal.html`, `politica-cookies.html`, `politica-privacidad.html` — páginas legales (LSSI-CE / RGPD)
  - `presentacion-*.pdf` — presentaciones comerciales por sector; no están enlazadas desde el sitio, se usan para envío directo a prospectos
  - `CNAME`, `.nojekyll` — necesarios para GitHub Pages
- `_archivo-versiones-previas/` — borradores antiguos, fuera de uso, no se publican

## Integraciones externas

- Formulario de contacto → Formspree (`https://formspree.io/f/xojoqook`)
- Enlace directo de WhatsApp (`wa.me/34634237322`)
- Google Fonts (Inter, Playfair Display)
- Sin analítica instalada actualmente

## Pendiente conocido

- El Aviso Legal tiene el NIF marcado como "Pendiente de incorporar al tramitar el alta de autónomo".
- No hay registro MX en el DNS: los correos a equipo@candyads.es no llegan (hay un TXT de verificación de Zoho a medias).

## En marcha: sistema de leads para anunciantes

Requisito no negociable: el dato personal del lead va completo al anunciante y Candy Ads nunca lo almacena; solo un contador agregado. Decisiones tomadas: backend en Supabase Edge Function, envío por Amazon SES (Resend descartado porque retiene el contenido 30 días), anti-spam propio + ALTCHA (sin Turnstile: carga desde IPs de Cloudflare). El email de cada anunciante no va en JSON público, se guarda en Supabase.

## Convenciones

- Repositorio git independiente. No mezclar código, configuración ni contexto con el CRM Rocafer.
