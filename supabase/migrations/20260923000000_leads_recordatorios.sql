-- Candy Ads · recordatorios de confirmación de venta.
-- Dos avisos automáticos por lead sin confirmar (conversion = 'pendiente'): uno a los 15 días y otro a
-- los 30 días desde la recepción. Cada uno se envía como mucho una vez. No añaden ningún dato de la
-- persona: se identifican solo por su `ref`, igual que el resto del sistema de trazabilidad.

alter table public.leads_registro
  add column if not exists recordatorio_15_enviado_at timestamptz;
alter table public.leads_registro
  add column if not exists recordatorio_30_enviado_at timestamptz;

comment on column public.leads_registro.recordatorio_15_enviado_at is
  'Cuándo se envió el recordatorio de los 15 días (si procede). NULL = todavía no.';
comment on column public.leads_registro.recordatorio_30_enviado_at is
  'Cuándo se envió el recordatorio de los 30 días (si procede). NULL = todavía no.';

-- Leads que necesitan un recordatorio (15 o 30 días), con el email de destino de su anunciante.
-- Solo "enviado" (SES aceptó el mensaje original) y con conversion 'pendiente'. Como mucho una fila
-- por lead: si ya ha pasado de los 30 días y ninguno de los dos avisos se ha enviado (por ejemplo,
-- porque la tarea programada estuvo parada), se prioriza el de 30 y se cierran los dos a la vez
-- (ver marcar_recordatorio_enviado) para no enviar dos correos el mismo día ni repetir en bucle.
create or replace function public.leads_pendientes_recordatorio()
returns table (
  ref uuid,
  anunciante_slug text,
  destino text,
  referencia text,
  recibido_at timestamptz,
  tipo text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.ref,
    l.anunciante_slug,
    d.email_destino,
    upper(left(l.ref::text, 8)),
    l.recibido_at,
    case when l.recibido_at <= now() - interval '30 days' then '30' else '15' end
  from public.leads_registro l
  join public.anunciantes_destino d on d.slug = l.anunciante_slug and d.activo
  where l.estado = 'enviado'
    and l.conversion = 'pendiente'
    and (
      (l.recibido_at <= now() - interval '15 days' and l.recordatorio_15_enviado_at is null)
      or
      (l.recibido_at <= now() - interval '30 days' and l.recordatorio_30_enviado_at is null)
    )
  order by l.recibido_at asc
  limit 200;
$$;

-- Marca enviado el recordatorio de 15 o 30 días para un lead. Al marcar el de 30, cierra también el de
-- 15 si seguía sin marcar, para que la fila deje de aparecer en leads_pendientes_recordatorio.
create or replace function public.marcar_recordatorio_enviado(p_ref uuid, p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo = '15' then
    update public.leads_registro
    set recordatorio_15_enviado_at = now()
    where ref = p_ref;
  elsif p_tipo = '30' then
    update public.leads_registro
    set recordatorio_30_enviado_at = now(),
        recordatorio_15_enviado_at = coalesce(recordatorio_15_enviado_at, now())
    where ref = p_ref;
  end if;
end;
$$;

revoke all on function public.leads_pendientes_recordatorio() from public, anon, authenticated;
revoke all on function public.marcar_recordatorio_enviado(uuid, text) from public, anon, authenticated;
grant execute on function public.leads_pendientes_recordatorio() to service_role;
grant execute on function public.marcar_recordatorio_enviado(uuid, text) to service_role;
