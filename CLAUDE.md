# Candy Ads — sitio web

Proyecto **independiente**, sin relación con el CRM Rocafer (otro proyecto del mismo equipo, en otra carpeta/repositorio).

## Qué es

Landing page de Candy Ads: venta de espacios publicitarios en sobres de azúcar monodosis para bares y cafeterías (Sevilla). Sitio estático, sin backend propio ni build system — HTML plano servido tal cual.

- Titular: Miguel Cabrera Rodríguez
- Dominio: candyads.es
- Contacto: miguelcabrerardgz@gmail.com · 634 237 322

## Estructura

- `index.html` — landing principal (una sola página, imágenes embebidas en base64)
- `aviso-legal.html`, `politica-cookies.html`, `politica-privacidad.html` — páginas legales (LSSI-CE / RGPD)
- `presentacion-*.pdf` — presentaciones comerciales por sector (dental, gestoría, gimnasio, inmobiliarias); no están enlazadas desde el sitio, se usan para envío directo a prospectos
- `_archivo-versiones-previas/` — borradores antiguos, fuera de uso, conservados solo como referencia

## Integraciones externas

- Formulario de contacto → Formspree (`https://formspree.io/f/xojoqook`)
- Enlace directo de WhatsApp (`wa.me/34634237322`)
- Google Fonts (Inter, Playfair Display)
- Sin analítica (Google Analytics u otra) instalada actualmente

## Pendiente conocido

- El Aviso Legal tiene el NIF marcado como "Pendiente de incorporar al tramitar el alta de autónomo" — hay que completarlo en cuanto esté disponible.

## Convenciones

- Repositorio git local independiente (creado para este proyecto, sin remoto configurado todavía).
- No mezclar código, configuración ni contexto con el CRM Rocafer.
