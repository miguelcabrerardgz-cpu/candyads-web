# Candy Ads — sitio web

Proyecto **independiente**, sin relación con el CRM Rocafer (otro proyecto del mismo equipo, en otra carpeta/repositorio).

## Qué es

Landing page de Candy Ads: venta de espacios publicitarios en sobres de azúcar monodosis para bares y cafeterías (Sevilla). Sitio estático, sin build system — HTML plano servido tal cual.

- Titular: Miguel Cabrera Rodríguez
- Dominio: candyads.es (registrado en IONOS, DNS en Cloudflare en modo "DNS only")
- Contacto: equipo@candyads.es · 634 237 322

## Hosting

- GitHub Pages, repo público `candyads-web` (usuario `miguelcabrerardgz-cpu`), rama `main`, carpeta `/docs`.
- Se migró desde Cloudflare Pages porque las IPs de Cloudflare se bloquean en España durante partidos (LaLiga). El registro DNS NO debe volver a ir con proxy (nube naranja).
- El repo es público: nunca commitear claves, tokens ni datos personales.
- Rollback: el proyecto Cloudflare Pages `candyads` sigue existiendo (rama de producción `main`).

## Estructura

- `docs/` — lo único que se publica
  - `index.html` — landing principal (una sola página, imágenes embebidas en base64)
  - `aviso-legal.html`, `politica-cookies.html`, `politica-privacidad.html` — páginas legales (LSSI-CE / RGPD)
  - `presentacion-*.pdf` — presentaciones comerciales por sector; no están enlazadas desde el sitio, se usan para envío directo a prospectos. Generados con WeasyPrint desde un HTML que NO está en el repo; el 2026-09-22 se editaron directamente con PyMuPDF (email a `equipo@candyads.es` y logo oficial en portada y cabeceras). Si hay que volver a tocarlos, editar el PDF igual o rehacerlos desde su fuente, y usar siempre `equipo@candyads.es` (nunca el Gmail personal) y el logo oficial
  - `CNAME`, `.nojekyll` — necesarios para GitHub Pages
  - `lead.html`, `gracias.html`, `404.html`, `assets/lead.js`, `assets/lead.css` — formulario de leads por anunciante. El QR apunta a `/lead/<slug>`; GitHub Pages no tiene rewrites, así que `404.html` redirige a `lead.html?s=<slug>`. Todo el contenido dinámico se inserta con `textContent`. Páginas con CSP y `noindex`, sin recursos de terceros.
  - `data/anunciantes/<slug>.json` — config pública del anunciante (nombre, activo, tema de color/logo, campos). NUNCA poner aquí el email de destino: el repo es público, ese dato va en Supabase.
  - `assets/anunciantes/` — logos de anunciantes
  - `assets/candyads-icono.png` + `assets/candyads-logotipo.jpg` — logo oficial de Candy Ads (cubo + logotipo), extraído de la cabecera de `index.html` y reducido. Es el que se usa en `lead.html`, `gracias.html`, `404.html` y `panel.html` (clase `logo-top` en `lead.css`). NUNCA sustituirlo por el nombre escrito en texto: la marca es esa imagen. También va en el pie de la landing (dentro de una caja blanca, porque el pie es oscuro), en las tres páginas legales (barra blanca; NO aplicarle filtros CSS: el fondo blanco de la imagen se convierte en un cuadrado), como favicon de todas las páginas y en la cabecera del correo al anunciante (URL absoluta a `candyads.es/assets/...`, con `alt` por si el cliente bloquea imágenes). Si se cambia `lead.css`, subir el `?v=` de su enlace en los HTML (GitHub Pages cachea 10 min).
- `_archivo-versiones-previas/` — borradores antiguos, fuera de uso, no se publican

## Integraciones externas

- Formulario de contacto → Formspree (`https://formspree.io/f/xojoqook`)
- Enlace directo de WhatsApp (`wa.me/34634237322`)
- Google Fonts (Inter, Playfair Display)
- Sin analítica instalada actualmente

## Pendiente conocido

- Correo de equipo@candyads.es: recibe con Zoho Mail EU (MX mx/mx2/mx3.zoho.eu, SPF `include:zohomail.eu`). Falta comprobar/activar el DKIM de Zoho. Los leads salen por SES con sus propios DKIM (no tocar esos CNAME `*._domainkey`).
- SES: solicitud de acceso a producción enviada el 2026-09-21 (sigue en revisión hasta que AWS conteste, hasta 24 h). Hasta entonces solo envía a direcciones verificadas.

## Sistema de leads para anunciantes

Requisito no negociable: el dato personal del lead va completo al anunciante y Candy Ads nunca lo almacena (ni nombre, ni teléfono, ni email, ni fragmentos o iniciales de ellos). Solo se guarda un contador diario y un registro de trazabilidad por lead: referencia aleatoria, anunciante, hora exacta, estado (`pendiente`/`enviado`/`error`) e id de mensaje de SES (tabla `leads_registro`; la referencia de 8 caracteres también va en el correo al anunciante para cotejar). "Enviado" = SES aceptó el mensaje, no confirma entrega a la bandeja; eso requeriría eventos SES→SNS (no hecho).

Arquitectura (formulario en `docs/`, backend fuera de Cloudflare porque sus IPs se bloquean en España en partidos):
- `lambda/` — endpoint público en **AWS Lambda** `candyads-lead` (eu-west-1, Function URL, auth NONE; CORS en el código, solo `https://candyads.es`). Rutas `/challenge` (reto ALTCHA firmado) y `/lead`. Node: `npm test` (15 tests), `npm run build` -> `dist/index.mjs` y zip para subir a mano en la consola de Lambda. Falla cerrado si falta configuración.
- Envío por **Amazon SES** (identidad `candyads.es` verificada, DKIM, DMARC p=none). El rol de Lambda solo tiene `ses:SendEmail` con remitente `leads@candyads.es`. Sin claves de AWS de larga duración. Resend descartado: retiene el contenido 30 días.
- `supabase/migrations/` — proyecto Supabase `candyads-leads` (eu-central-1). Solo contadores (`leads_count`), email de destino por anunciante (`anunciantes_destino`), retos ALTCHA usados y admins del panel. Lambda solo llama a funciones RPC (`destino_de`, `reservar_lead_ref`, `confirmar_lead_ref`, `fallar_lead_ref`, `consumir_reto`; `reservar_lead`/`liberar_lead` son las antiguas, ya sin uso) con la secret key; un anónimo recibe 401 en todo.
- Anti-spam: ALTCHA (prueba de trabajo, en `docs/assets/altcha/`, sin terceros) + campo trampa + límite diario por anunciante + límite por IP solo en memoria. No se guardan IPs. Coste del reto: `ALTCHA_COST` (defecto 1000).
- Variables de entorno de Lambda: `ALLOWED_ORIGIN`, `SITE_URL`, `SUPABASE_URL`, `SES_FROM`, `SUPABASE_SECRET_KEY`, `ALTCHA_HMAC_SECRET`, `ALTCHA_HMAC_KEY_SECRET`. Los secretos solo viven ahí, nunca en el repo.
- El endpoint se configura en `ENDPOINT` de `docs/assets/lead.js` (en localhost usa `/api`).

Añadir un anunciante: 1) `docs/data/anunciantes/<slug>.json` (nombre, activo, tema, campos; sin email); 2) fila en `anunciantes_destino` de Supabase con su email y límite diario; 3) QR: pestaña "Generador de QR" del panel (escribir el slug, descargar SVG para imprenta o PNG; se genera en el navegador, sin enviar nada). Escanear siempre el QR con un móvil antes de imprimir.

Estado: Fases 1, 2a y 2b hechas y probadas en producción. El destino de `lacasa-piloto` es un email de PRUEBAS; cambiarlo al de José al salir a producción. SES: salida del modo pruebas solicitada el 2026-09-21 (caso AWS 179002340300449); AWS pidió más detalle y se respondió ese mismo día, pendiente de su decisión (hoy solo envía a direcciones verificadas). Pendiente: pasar Supabase a Pro, panel interno con Supabase Auth (2c, parte 2; el generador de QR ya está hecho), datos legales de La Casa (razón social, CIF, email de privacidad → campo `responsable` del JSON) y revisión de un abogado. La política de privacidad ya incluye la sección 8 (leads, encargado del tratamiento), publicada el 2026-09-21; el borrador de consulta jurídica vive fuera del repo (público), en `Desktop\candyads-abogado`.

Panel del equipo: `docs/panel.html` (noindex, CSP `script-src 'self'`, sin terceros). Un solo login (Supabase Auth, email+contraseña; solo emails de `panel_admins`, comprobado con la RPC `es_admin`) y barra de herramientas. `assets/panel/core.js` = login, permisos y navegación; cada herramienta es un archivo aparte que se registra con `PanelCore.registrar({id, titulo, montar(cont, ctx)})`: `trazabilidad.js` (contadores por anunciante y vista por días con hora, referencia y estado; avisa en rojo de `pendiente`/`error`) y `qr.js` (generador de QR con `qrcode-lib.js`, MIT, alojada aquí). **Añadir una herramienta (p. ej. un CRM):** crear `assets/panel/<nombre>.js`, cargarlo en `panel.html` tras `core.js` (el orden de las líneas = orden de pestañas) y sus tablas en Supabase con RLS cerrada y política `using (public.es_admin())`. Hoy todos los admins ven todo; si hace falta separar permisos por herramienta, añadir una columna de roles a `panel_admins` y filtrar en `core.js`. URL y publishable key son públicas; la secret key nunca. `tools/qr.html` sigue existiendo como versión local sin conexión, pero el generador de uso normal es el del panel.

## Convenciones

- Repositorio git independiente. No mezclar código, configuración ni contexto con el CRM Rocafer.
