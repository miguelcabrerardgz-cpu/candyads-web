-- Candy Ads · permite borrar una campaña desde el panel (con confirmación), sin romper su auditoría
-- ni obligar a arrastrar el historial de leads con ella.

-- campanas_cambios queda con el slug como texto suelto (igual que ya pasa en leads_count/leads_registro):
-- si se quita la FK y se hiciera on delete cascade, borrar la campaña también borraría el rastro de sus
-- cambios de email_destino — justo lo contrario de para qué sirve esa tabla (evitar que un cambio
-- sospechoso se pueda tapar borrando después la ficha).
do $$
declare
  c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.campanas_cambios'::regclass and contype = 'f';
  if c is not null then
    execute format('alter table public.campanas_cambios drop constraint %I', c);
  end if;
end $$;

-- El panel podía leer/crear/editar anunciantes_destino pero no borrar. leads_count y leads_registro no
-- tienen FK a esta tabla (ya eran texto suelto), así que el historial de una campaña sobrevive a su
-- borrado — solo deja de ser accesible desde el panel porque no queda ninguna campaña a la que asociarlo.
grant delete on public.anunciantes_destino to authenticated;
create policy anunciantes_destino_borrado_admin on public.anunciantes_destino
  for delete to authenticated using (public.es_admin());
