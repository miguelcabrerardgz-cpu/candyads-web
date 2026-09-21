-- Candy Ads · sistema de leads.
-- Principio de diseño: en esta base de datos NO existe ninguna tabla que pueda contener
-- datos personales de un lead. Solo hay contadores agregados y datos de negocio.

-- 1. Contador agregado por anunciante y día (sin datos personales).
create table if not exists public.leads_count (
  anunciante_slug text not null check (anunciante_slug ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  fecha           date not null,
  total           integer not null default 0 check (total >= 0),
  primary key (anunciante_slug, fecha)
);

-- 2. Destino y límite de cada anunciante (email de negocio; no es dato de un lead).
create table if not exists public.anunciantes_destino (
  slug           text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  email_destino  text not null check (email_destino ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  limite_diario  integer not null default 100 check (limite_diario between 1 and 10000),
  activo         boolean not null default true
);

-- 3. Retos ALTCHA ya utilizados (huella aleatoria, no personal): impide reutilizar una solución.
create table if not exists public.altcha_usados (
  huella  text primary key,
  expira  timestamptz not null
);
create index if not exists altcha_usados_expira_idx on public.altcha_usados (expira);

-- 4. Quién puede ver el panel interno.
create table if not exists public.panel_admins (
  email text primary key
);

comment on table public.leads_count is
  'Solo contadores agregados. Prohibido añadir columnas con datos personales de leads.';

-- RLS cerrada por defecto en todas las tablas.
alter table public.leads_count         enable row level security;
alter table public.anunciantes_destino enable row level security;
alter table public.altcha_usados       enable row level security;
alter table public.panel_admins        enable row level security;

revoke all on public.leads_count, public.anunciantes_destino,
              public.altcha_usados, public.panel_admins from anon, authenticated;

-- El panel interno solo puede LEER leads_count, y solo un administrador.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.panel_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

grant select on public.leads_count to authenticated;
create policy leads_count_lectura_admin on public.leads_count
  for select to authenticated using (public.es_admin());

-- Reserva atómica de un lead: respeta el límite diario del anunciante.
-- Devuelve false si el anunciante no existe, está inactivo o ha llegado a su límite.
create or replace function public.reservar_lead(p_slug text)
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

  return v_total is not null;
end;
$$;

-- Deshace una reserva cuando el email no se pudo enviar (el contador debe ser exacto: se factura con él).
create or replace function public.liberar_lead(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.leads_count
  set total = greatest(total - 1, 0)
  where anunciante_slug = p_slug
    and fecha = (now() at time zone 'Europe/Madrid')::date;
$$;

-- Marca un reto ALTCHA como usado. Devuelve false si ya se había usado.
create or replace function public.consumir_reto(p_huella text, p_expira timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.altcha_usados where expira < now();
  insert into public.altcha_usados (huella, expira)
  values (p_huella, p_expira)
  on conflict (huella) do nothing;
  return found;
end;
$$;

-- Email de destino de un anunciante activo (null si no existe o está inactivo).
create or replace function public.destino_de(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email_destino from public.anunciantes_destino where slug = p_slug and activo;
$$;

-- Estas funciones solo las puede llamar el backend (service_role), nunca un navegador.
revoke all on function public.reservar_lead(text)                  from public, anon, authenticated;
revoke all on function public.liberar_lead(text)                   from public, anon, authenticated;
revoke all on function public.consumir_reto(text, timestamptz)     from public, anon, authenticated;
revoke all on function public.destino_de(text)                     from public, anon, authenticated;
grant execute on function public.reservar_lead(text)               to service_role;
grant execute on function public.liberar_lead(text)                to service_role;
grant execute on function public.consumir_reto(text, timestamptz)  to service_role;
grant execute on function public.destino_de(text)                  to service_role;
