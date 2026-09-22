# Protocolo de brecha de seguridad — Candy Ads

> Documento interno de una página. Aplica a cualquier incidente que afecte a datos personales tratados por Candy Ads (propios o por cuenta de un anunciante).

### 1. Qué se considera una brecha de seguridad

Cualquier incidente de seguridad que provoque la destrucción, pérdida, alteración, comunicación o acceso no autorizados a datos personales. Ejemplos: acceso indebido a Supabase o a la consola de AWS, pérdida o filtración de credenciales (Supabase, AWS, Zoho), error humano que expone datos (por ejemplo, un correo enviado al destinatario equivocado), malware, o un aviso de un tercero (anunciante, proveedor, investigador de seguridad).

### 2. Quién detecta

Cualquier miembro del equipo de Candy Ads, alertas automáticas de AWS o Supabase (CloudWatch, avisos del panel de administración), o notificación recibida de un tercero (anunciante, proveedor, usuario del sitio).

### 3. A quién avisar internamente

Quien detecte un posible incidente lo comunica de inmediato a **Miguel Cabrera Rodríguez** (equipo@candyads.es · 634 237 322), que centraliza la respuesta mientras el equipo sea de una o dos personas.

### 4. Qué se registra para cada incidente

- Fecha y hora de detección (y, si se conoce, de origen del incidente).
- Naturaleza de la brecha (confidencialidad, integridad o disponibilidad).
- Categorías y volumen aproximado de datos e interesados afectados.
- Consecuencias probables.
- Medidas ya adoptadas o propuestas para atajarla y mitigar sus efectos.

Este registro se conserva aunque finalmente no proceda notificar a la AEPD, conforme al art. 33.5 RGPD.

### 5. Evaluación del riesgo

Se valora: ¿hay datos personales afectados? ¿de leads (transmitidos por cuenta de un anunciante) o de tratamientos propios de Candy Ads? ¿existe riesgo para los derechos y libertades de las personas afectadas, atendiendo a la probabilidad y gravedad del daño? El resultado determina si procede notificar a la AEPD y/o a los propios interesados.

### 6. Notificación al anunciante afectado

Si la brecha afecta a datos tratados por cuenta de un anunciante (fase de transmisión o trazabilidad), Candy Ads se lo notifica en un plazo máximo de **24 horas** desde que tenga conocimiento de ella, conforme al Contrato de Encargo del Tratamiento (documento 1, cláusula 12).

### 7. Notificación a la Agencia Española de Protección de Datos (AEPD)

Si existe riesgo para los derechos y libertades de las personas, se notifica a la AEPD en un plazo máximo de **72 horas** desde que se tenga conocimiento (art. 33 RGPD), a través de su sede electrónica (sedeagpd.gob.es).

### 8. Comunicación a los propios interesados

Solo si el riesgo es **alto** para sus derechos y libertades (art. 34 RGPD): se les informa en lenguaje claro y sencillo, con las mismas categorías de contenido que la plantilla del punto 9.

### 9. Plantilla de comunicación (AEPD / anunciante / interesados)

- Fecha y descripción del incidente.
- Categorías y volumen aproximado de datos e interesados afectados.
- Nombre y datos de contacto de Candy Ads (Miguel Cabrera Rodríguez, equipo@candyads.es).
- Consecuencias probables.
- Medidas adoptadas o propuestas para atajar la brecha y mitigar sus posibles efectos negativos.

### 10. Revisión posterior

Tras resolver el incidente, se revisa qué medida técnica u organizativa lo habría evitado, y se actualiza el Registro de Actividades de Tratamiento (documento 4) o el código si procede.
