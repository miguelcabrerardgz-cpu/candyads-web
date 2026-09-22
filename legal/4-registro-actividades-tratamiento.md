# Registro de Actividades de Tratamiento (RAT) — Candy Ads

> Conforme al art. 30 RGPD. **Documento vivo**: actualizar cada vez que cambie una actividad, un proveedor o una finalidad. Responsable: Miguel Cabrera Rodríguez (NIF 29541337E) · equipo@candyads.es · 634 237 322.

---

## 1. Consultas a través del formulario de contacto de la landing

| | |
|---|---|
| **Rol de Candy Ads** | Responsable |
| **Interesados** | Visitantes de candyads.es que rellenan el formulario de contacto |
| **Categorías de datos** | Nombre, empresa (opcional), tipo de consulta, teléfono (opcional), email, mensaje |
| **Finalidad** | Atender consultas comerciales sobre el servicio |
| **Base jurídica** | Consentimiento (art. 6.1.a RGPD), mediante casilla desmarcada por defecto |
| **Destinatarios / encargados** | Amazon Web Services (AWS Lambda + Amazon SES) |
| **Transferencias internacionales** | Procesamiento en Irlanda (UE); AWS adherida al Data Privacy Framework UE-EE. UU. para cualquier acceso desde EE. UU. |
| **Plazo de conservación** | No se almacena tras el envío del correo; sin base de datos ni copia persistente |
| **Medidas de seguridad** | Cifrado en tránsito (TLS), campo trampa anti-bot, límite de tiempo mínimo de envío, límite de peticiones por IP en memoria (sin registrar IPs) |

## 2. Gestión de anunciantes y facturación

| | |
|---|---|
| **Rol de Candy Ads** | Responsable |
| **Interesados** | Personas de contacto de los anunciantes |
| **Categorías de datos** | Nombre, empresa, email, teléfono, datos de facturación |
| **Finalidad** | Gestión de la relación contractual y facturación de los servicios publicitarios |
| **Base jurídica** | Ejecución de contrato (art. 6.1.b RGPD) y obligación legal (art. 6.1.c RGPD, normativa fiscal) |
| **Destinatarios / encargados** | Ninguno (gestión propia) |
| **Transferencias internacionales** | No hay |
| **Plazo de conservación** | Durante la relación contractual y, tras su finalización, el plazo de prescripción fiscal (mínimo 4-5 años) |
| **Medidas de seguridad** | Acceso restringido, contratos firmados |

## 3. Gestión de establecimientos de hostelería colaboradores

| | |
|---|---|
| **Rol de Candy Ads** | Responsable |
| **Interesados** | Titulares o personas de contacto de bares y cafeterías colaboradores |
| **Categorías de datos** | Nombre del negocio, dirección, persona de contacto, teléfono |
| **Finalidad** | Coordinar la entrega y retirada de sobres |
| **Base jurídica** | Ejecución de contrato / interés legítimo (art. 6.1.b / 6.1.f RGPD) |
| **Destinatarios / encargados** | Ninguno |
| **Transferencias internacionales** | No hay |
| **Plazo de conservación** | Durante la relación de colaboración y [2] años tras su finalización |
| **Medidas de seguridad** | Acceso restringido |

## 4. Recogida de solicitudes de contacto por código QR (fase de recogida)

| | |
|---|---|
| **Rol de Candy Ads** | Corresponsable, junto con cada Anunciante (art. 26 RGPD) — ver documento 1 |
| **Interesados** | Personas que escanean el código QR de un sobre y rellenan el formulario |
| **Categorías de datos** | Nombre, teléfono, email, mensaje y demás campos configurados por el Anunciante |
| **Finalidad** | Permitir que el Anunciante atienda la solicitud de contacto del Interesado |
| **Base jurídica** | Consentimiento del Interesado (art. 6.1.a RGPD), casilla desmarcada y redactada por finalidad concreta |
| **Destinatarios / encargados** | Corresponsable: el Anunciante correspondiente |
| **Transferencias internacionales** | No hay en esta fase |
| **Plazo de conservación** | No se almacena; el dato solo existe durante la petición de envío |
| **Medidas de seguridad** | Formulario con información en capas, consentimiento explícito, prueba de trabajo ALTCHA sin cookies ni terceros de rastreo, campo trampa |

## 5. Transmisión de solicitudes de contacto (fase de transmisión)

| | |
|---|---|
| **Rol de Candy Ads** | Encargado del tratamiento por cuenta de cada Anunciante (art. 28 RGPD) — ver documento 1 |
| **Interesados** | Los mismos que en la actividad 4 |
| **Categorías de datos** | Las mismas que en la actividad 4 |
| **Finalidad** | Reenviar la solicitud del Interesado al Anunciante por correo electrónico, con "Responder a" el Interesado |
| **Base jurídica** | Instrucciones del responsable (el Anunciante), conforme al art. 28 RGPD |
| **Destinatarios / encargados** | Subencargado: Amazon Web Services (AWS Lambda + Amazon SES) |
| **Transferencias internacionales** | Procesamiento en Irlanda (UE); AWS adherida al Data Privacy Framework UE-EE. UU. |
| **Plazo de conservación** | No se conserva copia del contenido del formulario en ningún momento tras el envío |
| **Medidas de seguridad** | Envío cifrado (TLS), sin registro del contenido en logs, borrado inmediato tras el envío, notificaciones de rebote/queja de SES sin encabezados originales |

## 6. Trazabilidad técnica de envíos

| | |
|---|---|
| **Rol de Candy Ads** | Encargado del tratamiento (registro seudonimizado, sin identificar a la persona) |
| **Interesados** | No identificables a partir de este registro (dato seudonimizado) |
| **Categorías de datos** | Referencia aleatoria del envío, anunciante, fecha y hora, estado de entrega, resultado de conversión (venta / sin venta) marcado por el propio anunciante |
| **Finalidad** | Verificar que cada solicitud llega al anunciante, informar de resultados y facturar |
| **Base jurídica** | Interés legítimo de Candy Ads y del Anunciante en verificar la prestación del servicio (art. 6.1.f RGPD) |
| **Destinatarios / encargados** | Subencargado: Supabase |
| **Transferencias internacionales** | Procesamiento en Fráncfort (UE); Supabase ampara cualquier acceso desde EE. UU. en Cláusulas Contractuales Tipo |
| **Plazo de conservación** | 12 meses desde la recepción de cada solicitud |
| **Medidas de seguridad** | Seguridad a nivel de fila (RLS) en la base de datos, acceso restringido a administradores autenticados, sin IP ni contenido del mensaje del Interesado |

## 7. Administración del panel interno

| | |
|---|---|
| **Rol de Candy Ads** | Responsable |
| **Interesados** | Administradores del panel (equipo de Candy Ads) |
| **Categorías de datos** | Email y credenciales de acceso |
| **Finalidad** | Gestionar el acceso al panel de trazabilidad y herramientas internas |
| **Base jurídica** | Interés legítimo (art. 6.1.f RGPD) |
| **Destinatarios / encargados** | Encargado: Supabase (autenticación) |
| **Transferencias internacionales** | Procesamiento en la UE |
| **Plazo de conservación** | Mientras la persona sea administradora, más [1 año] |
| **Medidas de seguridad** | Autenticación con contraseña, RLS, panel con cabeceras de seguridad (CSP) y `noindex` |

---

**Última actualización:** 2026-09-22. Próxima revisión recomendada: cuando se incorpore el primer anunciante en producción real, o cada 12 meses.
