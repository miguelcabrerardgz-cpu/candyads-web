-- Candy Ads · endurecimiento tras la auditoría de seguridad del 2026-10-11 (avisos del Security Advisor).
--
-- 1. search_path fijo en las dos funciones auxiliares de Preventa que no lo tenían ("Function Search Path
--    Mutable"): sin él, una función podría resolver un nombre contra un esquema que no es el esperado.
--    Solo usan funciones de jsonb del catálogo, así que basta con pg_catalog.
-- 2. Las funciones de trigger (historial del CRM y auditoría del email de destino) y rls_auto_enable() (la
--    crea Supabase para activar RLS en tablas nuevas) eran ejecutables por anon y authenticated. No sirven de
--    nada llamadas a mano, pero no tienen por qué estar expuestas: se revoca EXECUTE. Un trigger se dispara
--    igual sin ese permiso (Postgres solo lo comprueba al crear el trigger).
--
-- No cambia el comportamiento del panel, del CRM, de Preventa ni de la Lambda.

alter function public.preventa_recalcular(jsonb) set search_path = pg_catalog;
alter function public.preventa_valor(jsonb, jsonb, text) set search_path = pg_catalog;

revoke execute on function public.crm_guardar_historial() from public, anon, authenticated;
revoke execute on function public.registrar_cambio_email_destino() from public, anon, authenticated;

do $$ begin
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
exception when undefined_function then null; end $$;
