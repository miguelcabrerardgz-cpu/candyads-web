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
  - `lead.html`, `gracias.html`, `404.html`, `assets/lead.js`, `assets/lead.css` — formulario de leads por anunciante. El QR apunta a `/lead/<slug>`; GitHub Pages no tiene rewrites, así que `404.html` redirige a `lead.html?s=<slug>`. Todo el contenido dinámico se inserta con `textContent`. Páginas con CSP y `noindex`, sin recursos de terceros.
  - `data/anunciantes/<slug>.json` — config pública del anunciante (nombre, activo, tema de color/logo, campos). NUNCA poner aquí el email de destino: el repo es público, ese dato va en Supabase.
  - `assets/anunciantes/` — logos de anunciantes
- `_archivo-versiones-previas/` — borradores antiguos, fuera de uso, no se publican

## Integraciones externas

- Formulario de contacto → Formspree (`https://formspree.io/f/xojoqook`)
- Enlace directo de WhatsApp (`wa.me/34634237322`)
- Google Fonts (Inter, Playfair Display)
- Sin analítica instalada actualmente

## Pendiente conocido

- El Aviso Legal tiene el NIF marcado como "Pendiente de incorporar al tramitar el alta de autónomo".
- Correo de equipo@candyads.es: recibe con Zoho Mail EU (MX mx/mx2/mx3.zoho.eu, SPF `include:zohomail.eu`). Falta comprobar/activar el DKIM de Zoho. Los leads salen por SES con sus propios DKIM (no tocar esos CNAME `*._domainkey`).
- SES: solicitud de acceso a producción enviada el 2026-09-21 (sigue en revisión hasta que AWS conteste, hasta 24 h). Hasta entonces solo envía a direcciones verificadas.

## Sistema de leads para anunciantes

Requisito no negociable: el dato personal del lead va completo al anunciante y Candy Ads nunca lo almacena; solo un contador agregado.

Arquitectura (formulario en `docs/`, backend fuera de Cloudflare porque sus IPs se bloquean en España en partidos):
- `lambda/` — endpoint público en **AWS Lambda** `candyads-lead` (eu-west-1, Function URL, auth NONE; CORS en el código, solo `https://candyads.es`). Rutas `/challenge` (reto ALTCHA firmado) y `/lead`. Node: `npm test` (15 tests), `npm run build` -> `dist/index.mjs` y zip para subir a mano en la consola de Lambda. Falla cerrado si falta configuración.
- Envío por **Amazon SES** (identidad `candyads.es` verificada, DKIM, DMARC p=none). El rol de Lambda solo tiene `ses:SendEmail` con remitente `leads@candyads.es`. Sin claves de AWS de larga duración. Resend descartado: retiene el contenido 30 días.
- `supabase/migrations/` — proyecto Supabase `candyads-leads` (eu-central-1). Solo contadores (`leads_count`), email de destino por anunciante (`anunciantes_destino`), retos ALTCHA usados y admins del panel. Lambda solo llama a funciones RPC (`destino_de`, `reservar_lead`, `liberar_lead`, `consumir_reto`) con la secret key; un anónimo recibe 401 en todo.
- Anti-spam: ALTCHA (prueba de trabajo, en `docs/assets/altcha/`, sin terceros) + campo trampa + límite diario por anunciante + límite por IP solo en memoria. No se guardan IPs. Coste del reto: `ALTCHA_COST` (defecto 1000).
- Variables de entorno de Lambda: `ALLOWED_ORIGIN`, `SITE_URL`, `SUPABASE_URL`, `SES_FROM`, `SUPABASE_SECRET_KEY`, `ALTCHA_HMAC_SECRET`, `ALTCHA_HMAC_KEY_SECRET`. Los secretos solo viven ahí, nunca en el repo.
- El endpoint se configura en `ENDPOINT` de `docs/assets/lead.js` (en localhost usa `/api`).

Añadir un anunciante: 1) `docs/data/anunciantes/<slug>.json` (nombre, activo, tema, campos; sin email); 2) fila en `anunciantes_destino` de Supabase con su email y límite diario; 3) QR a `https://candyads.es/lead/<slug>`.

Estado: Fases 1, 2a y 2b hechas y probadas en producción. El destino de `lacasa-piloto` es un email de PRUEBAS; cambiarlo al de José al salir a producción. Pendiente: pedir a AWS la salida del modo pruebas de SES (hoy solo envía a direcciones verificadas), pasar Supabase a Pro, 2c (generador de QR local y panel interno con Supabase Auth), datos legales de La Casa y actualizar políticas de privacidad/cookies.

## Convenciones

- Repositorio git independiente. No mezclar código, configuración ni contexto con el CRM Rocafer.
