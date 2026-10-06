-- Candy Ads · cada campaña puede asociarse a su cliente del CRM (id del cliente dentro de crm_datos.ncrm_crm).
-- Lo rellena el panel: al crear la campaña desde un presupuesto aceptado en el CRM, o a mano desde la ficha
-- de la campaña. Con él, la ficha del cliente en el CRM muestra los leads y ventas de todas sus campañas.
-- No se publica (config_publico_de no lo incluye): solo lo lee el panel (RLS es_admin()).
alter table public.anunciantes_destino
  add column if not exists crm_cliente_id integer check (crm_cliente_id is null or crm_cliente_id > 0);
create index if not exists anunciantes_destino_crm_cliente_idx on public.anunciantes_destino (crm_cliente_id)
  where crm_cliente_id is not null;
