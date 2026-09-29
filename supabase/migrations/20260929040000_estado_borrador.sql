-- Candy Ads · nuevo estado 'borrador': una campaña recién creada no es pública hasta que se lanza desde el
-- panel (borrador → activa). Todo lo que decide si /lead/<slug> acepta contactos ya comprueba
-- estado = 'activa' (destino_de, reservar_lead_ref, config_publico_de vía la Lambda), así que un borrador
-- queda bloqueado igual que una campaña pausada, sin más cambios. Las campañas existentes no cambian.
do $$
declare
  c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.anunciantes_destino'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%estado%';
  if c is not null then
    execute format('alter table public.anunciantes_destino drop constraint %I', c);
  end if;
end $$;

alter table public.anunciantes_destino
  add constraint anunciantes_destino_estado_check
    check (estado in ('borrador', 'activa', 'pausada', 'finalizada'));
alter table public.anunciantes_destino alter column estado set default 'borrador';
