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
- Inter y Playfair Display: autoalojadas en `docs/assets/fonts/` (solo variantes `latin`/`latin-ext`, sin cirílico/griego/vietnamita) + `docs/assets/fonts.css`. NO volver a apuntar a `fonts.googleapis.com`: era la única llamada a un tercero del sitio y ya no existe. Si se necesita otro peso o familia, descargar el `.woff2` con el mismo procedimiento (CSS de Google con user-agent moderno, filtrar `latin`/`latin-ext`) en vez de enlazar Google Fonts.
- Sin analítica instalada actualmente

## Pendiente conocido

- Correo de equipo@candyads.es: recibe con Zoho Mail EU (MX mx/mx2/mx3.zoho.eu, SPF `include:zohomail.eu`). Falta comprobar/activar el DKIM de Zoho. Los leads salen por SES con sus propios DKIM (no tocar esos CNAME `*._domainkey`).
- SES: solicitud de acceso a producción enviada el 2026-09-21 (sigue en revisión hasta que AWS conteste, hasta 24 h). Hasta entonces solo envía a direcciones verificadas.
- Revisión legal externa (RGPD/LSSI/mercantil) del sistema de leads, 2026-09-22, en curso por fases (ver más abajo). Fase 1 (política de privacidad, SES, fuentes, base legal del banner) hecha. Fase 2 (identificación del anunciante en el formulario, checkbox de consentimiento, línea de menores), Fase 3 (sustituir Formspree) y Fase 4 (documentos legales fuera del repo) pendientes o en curso — ver detalle en la sección de leads.

## Sistema de leads para anunciantes

Requisito no negociable: el dato personal del lead va completo al anunciante y Candy Ads nunca lo almacena (ni nombre, ni teléfono, ni email, ni fragmentos o iniciales de ellos). Solo se guarda un contador diario y un registro de trazabilidad por lead: referencia aleatoria, anunciante, hora exacta, estado (`pendiente`/`enviado`/`error`) e id de mensaje de SES (tabla `leads_registro`; la referencia de 8 caracteres también va en el correo al anunciante para cotejar). "Enviado" = SES aceptó el mensaje, no confirma entrega a la bandeja; eso requeriría eventos SES→SNS (no hecho).

**Confirmación de venta (2026-09-22):** el correo que recibe el anunciante lleva, al final y discretos, dos enlaces "¿Terminó en venta? Sí / No, de momento" → `docs/confirmar.html?ref=<uuid completo>&r=venta|sin_venta`. La página (misma plantilla que `lead.html`/`gracias.html`, lógica en `initConfirmar()`/`pintarConfirmar()` de `assets/lead.js`) exige un clic explícito en un botón antes de llamar a la Lambda — a propósito, para que un rastreador de enlaces de un antivirus/cliente de correo que solo hace GET del link no dispare la confirmación por error. Al pulsar, hace POST a `/confirmar` `{ref, conversion}`; la Lambda valida formato y llama a la RPC `marcar_conversion` (columna `conversion` en `leads_registro`: `pendiente`/`venta`/`sin_venta`, más `conversion_at`). Se puede marcar más de una vez (el anunciante puede cambiar de opinión); solo identifica el envío por su `ref` aleatoria, ningún dato de la persona. El panel (pestaña Trazabilidad) muestra el resultado por lead y un resumen de venta/sin venta en la vista de cada día.

Pendiente (fase siguiente, no construida): recordatorio automático si un lead lleva ~30 días como `pendiente` de conversión — necesitaría una tarea programada (EventBridge + Lambda o `pg_cron` en Supabase) que reenvíe el mismo par de enlaces; no lo monto hasta que haga falta para no añadir infraestructura sin usar.

Arquitectura (formulario en `docs/`, backend fuera de Cloudflare porque sus IPs se bloquean en España en partidos):
- `lambda/` — endpoint público en **AWS Lambda** `candyads-lead` (eu-west-1, Function URL, auth NONE; CORS en el código, solo `https://candyads.es`). Rutas `/challenge` (reto ALTCHA firmado), `/lead` y `/confirmar` (confirmación de venta, sin ALTCHA: el riesgo lo acota que `ref` es un uuid v4 impredecible). Node: `npm test` (19 tests), `npm run build` -> `dist/index.mjs` y zip para subir a mano en la consola de Lambda. Falla cerrado si falta configuración.
- Envío por **Amazon SES** (identidad `candyads.es` verificada, DKIM, DMARC p=none). El rol de Lambda solo tiene `ses:SendEmail` con remitente `leads@candyads.es`. Sin claves de AWS de larga duración. Resend descartado: retiene el contenido 30 días.
- `supabase/migrations/` — proyecto Supabase `candyads-leads` (eu-central-1). Solo contadores (`leads_count`), email de destino por anunciante (`anunciantes_destino`), retos ALTCHA usados, estado de conversión de cada lead y admins del panel. Lambda solo llama a funciones RPC (`destino_de`, `reservar_lead_ref`, `confirmar_lead_ref`, `fallar_lead_ref`, `consumir_reto`, `marcar_conversion`; `reservar_lead`/`liberar_lead` son las antiguas, ya sin uso) con la secret key; un anónimo recibe 401 en todo.
- Anti-spam: ALTCHA (prueba de trabajo, en `docs/assets/altcha/`, sin terceros) + campo trampa + límite diario por anunciante + límite por IP solo en memoria. No se guardan IPs. Coste del reto: `ALTCHA_COST` (defecto 1000).
- Variables de entorno de Lambda: `ALLOWED_ORIGIN`, `SITE_URL`, `SUPABASE_URL`, `SES_FROM`, `SUPABASE_SECRET_KEY`, `ALTCHA_HMAC_SECRET`, `ALTCHA_HMAC_KEY_SECRET`. Los secretos solo viven ahí, nunca en el repo.
- El endpoint se configura en `ENDPOINT` de `docs/assets/lead.js` (en localhost usa `/api`).

Añadir un anunciante: 1) `docs/data/anunciantes/<slug>.json` (nombre, activo, tema, campos; sin email); 2) fila en `anunciantes_destino` de Supabase con su email y límite diario; 3) QR: pestaña "Generador de QR" del panel (escribir el slug, descargar SVG para imprenta o PNG; se genera en el navegador, sin enviar nada). Escanear siempre el QR con un móvil antes de imprimir.

Estado: Fases 1, 2a y 2b hechas y probadas en producción. El destino de `lacasa-piloto` es un email de PRUEBAS; cambiarlo al de José al salir a producción. SES: salida del modo pruebas solicitada el 2026-09-21 (caso AWS 179002340300449); AWS pidió más detalle y se respondió ese mismo día, pendiente de su decisión (hoy solo envía a direcciones verificadas). Pendiente: pasar Supabase a Pro, panel interno con Supabase Auth (2c, parte 2; el generador de QR ya está hecho), datos legales de La Casa (razón social, CIF, email de privacidad → campo `responsable` del JSON) y revisión de un abogado. La política de privacidad ya incluye la sección 8 (leads, encargado del tratamiento), publicada el 2026-09-21; el borrador de consulta jurídica vive fuera del repo (público), en `Desktop\candyads-abogado`.

Panel del equipo: `docs/panel.html` (noindex, CSP `script-src 'self'`, sin terceros). Un solo login (Supabase Auth, email+contraseña; solo emails de `panel_admins`, comprobado con la RPC `es_admin`) y barra de herramientas. `assets/panel/core.js` = login, permisos y navegación; cada herramienta es un archivo aparte que se registra con `PanelCore.registrar({id, titulo, montar(cont, ctx)})`: `trazabilidad.js` (contadores por anunciante y vista por días con hora, referencia y estado; avisa en rojo de `pendiente`/`error`) y `qr.js` (generador de QR con `qrcode-lib.js`, MIT, alojada aquí). **Añadir una herramienta (p. ej. un CRM):** crear `assets/panel/<nombre>.js`, cargarlo en `panel.html` tras `core.js` (el orden de las líneas = orden de pestañas) y sus tablas en Supabase con RLS cerrada y política `using (public.es_admin())`. Hoy todos los admins ven todo; si hace falta separar permisos por herramienta, añadir una columna de roles a `panel_admins` y filtrar en `core.js`. URL y publishable key son públicas; la secret key nunca. `tools/qr.html` sigue existiendo como versión local sin conexión, pero el generador de uso normal es el del panel.

## Revisión legal 2026-09-22 (RGPD/LSSI/mercantil, por fases)

Fase 1 (hecha, publicada): política de privacidad reescrita — Candy Ads es responsable de sus tratamientos propios y, para el sistema de leads QR, **corresponsable con el anunciante en la fase de recogida** (art. 26 RGPD: diseño del formulario y consentimiento) y **encargado en la fase de transmisión** (art. 28 RGPD: envío del correo y trazabilidad); lista real de subencargados (AWS Lambda+SES Irlanda, Supabase Fráncfort, Zoho Mail UE) con su garantía de transferencia correcta (AWS: Data Privacy Framework: Supabase: Cláusulas Contractuales Tipo — **no** son lo mismo, no simplificar). Fuentes autoalojadas (ver arriba). Política de cookies corregida: `ca_ck` no es una cookie de servidor sino `localStorage` (index.html), amparada en la excepción del art. 22.2 LSSI (dato técnico necesario para el propio banner), no en el interés legítimo 6.1.f; se añadieron los derechos del interesado que faltaban. SES: `candyads.es` tenía "Reenvío de retroalimentación por correo electrónico" **habilitado** y ningún tema de SNS para rebotes/quejas — si un envío a un anunciante rebotaba, SES podía reenviar una copia del mensaje original (con el `Reply-To` y los datos del lead) por un canal fuera de la trazabilidad. Se desactivó el reenvío y se creó el tema SNS `candyads-ses-eventos` (arn:aws:sns:eu-west-1:033177020665:candyads-ses-eventos) con Bounce y Complaint apuntando a él **sin** "incluir encabezados originales", suscrito por email a equipo@candyads.es (pendiente de confirmar el enlace que manda SNS). Auditados los logs de la Lambda (`log.info`/`log.error` en `core.mjs`): nunca imprimen `datos`, solo `slug`/`status`/`code`/nombre de error — ya estaban limpios.

Fase 2 (formulario `/lead/<slug>`): pendiente identificar al anunciante con `razon_social`, `nif_cif`, `email_privacidad` en `docs/data/anunciantes/<slug>.json` — **`lacasa-piloto` no debe recibir tráfico real del QR hasta tener esos tres datos reales de La Casa Agency**; no rellenar con placeholders. Checkbox de consentimiento desmarcada por defecto con redacción específica por finalidad, y línea de menores de 14 años: pendientes de implementar en `assets/lead.js`.

Fase 3 (pendiente): sustituir Formspree (formulario de contacto de la landing, EE. UU.) por la misma arquitectura Lambda+SES que los leads, para no depender de un proveedor adicional; al terminar, quitar la mención a Formspree de privacidad y cookies.

Fase 4 (pendiente): contrato de encargo/corresponsabilidad para firmar con cada anunciante (Parte I art. 26, Parte II art. 28) y demás documentos legales — fuera de `docs/` (repo público), en una carpeta no publicada o fuera del repo.

## Convenciones

- Repositorio git independiente. No mezclar código, configuración ni contexto con el CRM Rocafer.
