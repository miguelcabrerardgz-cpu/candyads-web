-- Candy Ads · trazabilidad de leads.
-- Un registro por lead con SOLO: referencia aleatoria, anunciante, instante de recepción, estado y el
-- identificador del mensaje en SES. Ningún dato de la persona (ni nombre, ni teléfono, ni email, ni
-- fragmentos de ellos). La referencia también va en el correo al anunciante para poder cotejar.

create table if not exists public.leads_registro (
  ref             uuid primary key,
  anunciante_slug text not null check (anunciante_slug ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  recibido_at     timestamptz not null default now(),
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'error')),
  ses_message_id  text,
  actualizado_at  timestamptz not null default now()
);
create index if not exists leads_registro_slug_fecha_idx on public.leads_registro (anunciante_slug, recibido_at desc);
create index if not exists leads_registro_fecha_idx on public.leads_registro (recibido_at desc);

comment on table public.leads_registro is
  'Trazabilidad sin datos personales: referencia, anunciante, instante, estado y id de mensaje SES. Prohibido añadir datos de la persona.';

alter table public.leads_registro enable row level security;
revoke all on public.leads_registro from anon, authenticated;
grant select on public.leads_registro to authenticated;
create policy leads_registro_lectura_admin on public.leads_registro
  for select to authenticated using (public.es_admin());

-- Reserva atómica (igual que reservar_lead) y, si cabe, deja constancia del lead en estado 'pendiente'.
create or replace function public.reservar_lead_ref(p_slug text, p_ref uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite integer;
  v_total  integer;
begin
  select limite_diario into v_limite
  from public.anunciantes_destino
  where slug = p_slug and activo;

  if v_limite is null then
    return false;
  end if;

  insert into public.leads_count as l (anunciante_slug, fecha, total)
  values (p_slug, (now() at time zone 'Europe/Madrid')::date, 1)
  on conflict (anunciante_slug, fecha)
  do update set total = l.total + 1
  where l.total < v_limite
  returning l.total into v_total;

  if v_total is null then
    return false;
  end if;

  insert into public.leads_registro (ref, anunciante_slug) values (p_ref, p_slug);
  return true;
end;
$$;

-- SES aceptó el mensaje: el lead queda como 'enviado' con el id de mensaje de SES.
create or replace function public.confirmar_lead_ref(p_ref uuid, p_mensaje text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.leads_registro
  set estado = 'enviado', ses_message_id = left(p_mensaje, 200), actualizado_at = now()
  where ref = p_ref and estado = 'pendiente';
$$;

-- El envío falló: el lead queda como 'error' y se devuelve la reserva al contador del día en que se reservó.
create or replace function public.fallar_lead_ref(p_ref uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_at   timestamptz;
begin
  update public.leads_registro
  set estado = 'error', actualizado_at = now()
  where ref = p_ref and estado = 'pendiente'
  returning anunciante_slug, recibido_at into v_slug, v_at;

  if v_slug is not null then
    update public.leads_count
    set total = greatest(total - 1, 0)
    where anunciante_slug = v_slug
      and fecha = (v_at at time zone 'Europe/Madrid')::date;
  end if;
end;
$$;

revoke all on function public.reservar_lead_ref(text, uuid)  from public, anon, authenticated;
revoke all on function public.confirmar_lead_ref(uuid, text) from public, anon, authenticated;
revoke all on function public.fallar_lead_ref(uuid)          from public, anon, authenticated;
grant execute on function public.reservar_lead_ref(text, uuid)  to service_role;
grant execute on function public.confirmar_lead_ref(uuid, text) to service_role;
grant execute on function public.fallar_lead_ref(uuid)          to service_role;
