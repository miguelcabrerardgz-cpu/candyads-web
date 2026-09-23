-- Candy Ads · ficha completa de campaña (pestaña "Campañas" del panel).
-- Amplía anunciantes_destino con los datos que hoy solo viven en el JSON público
-- (docs/data/anunciantes/<slug>.json) o no existen en ningún sitio, para que el panel
-- pueda editarlos sin tocar el repo ni esperar a la caché de GitHub Pages.
--
-- `estado` sustituye a `activo`: antes había dos banderas de "activo" que sincronizar a
-- mano (esta tabla, para que la Lambda acepte el envío, y el JSON público, para que se
-- muestre el formulario) y ahora solo hay una, con tres niveles.

alter table public.anunciantes_destino
  add column if not exists estado text not null default 'activa'
    check (estado in ('activa', 'pausada', 'finalizada'));

update public.anunciantes_destino set estado = case when activo then 'activa' else 'pausada' end;

alter table public.anunciantes_destino
  add column if not exists razon_social           text,
  add column if not exists cif                    text,
  add column if not exists email_privacidad        text
    check (email_privacidad ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column if not exists sector                  text,
  add column if not exists zona                    text,
  add column if not exists fecha_alta              date not null default current_date,
  add column if not exists nombre_mostrado         text,
  add column if not exists tema_color              text
    check (tema_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists tema_color_secundario   text
    check (tema_color_secundario ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists tema_logo               text
    check (tema_logo ~ '^/assets/anunciantes/[a-z0-9._-]+\.(png|svg|jpg|jpeg|webp)$'),
  add column if not exists campos                  jsonb not null default '[]'::jsonb
    check (jsonb_typeof(campos) = 'array');

comment on column public.anunciantes_destino.estado is
  'Estado de la campaña. Si no es ''activa'', /lead/<slug> no debe mostrar el formulario.';
comment on column public.anunciantes_destino.email_destino is
  'Dónde llegan los leads de esta campaña. Cambiarlo queda auditado en campanas_cambios (ver trigger más abajo).';

-- Se conservan los valores que hoy vive el JSON de lacasa-piloto, para no perder nada al migrar.
update public.anunciantes_destino
set nombre_mostrado = 'La Casa Agency',
    tema_color = '#1C4C98',
    tema_color_secundario = '#909CCC',
    tema_logo = '/assets/anunciantes/lacasa.png',
    campos = '["nombre","telefono","email","interes_venta_alquiler","mensaje"]'::jsonb
where slug = 'lacasa-piloto';

-- Las funciones que comprobaban `activo` ahora comprueban `estado = 'activa'`.
create or replace function public.destino_de(p_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email_destino from public.anunciantes_destino where slug = p_slug and estado = 'activa';
$$;

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
  where slug = p_slug and estado = 'activa';

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
  where slug = p_slug and estado = 'activa';

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
  join public.anunciantes_destino d on d.slug = l.anunciante_slug and d.estado = 'activa'
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

alter table public.anunciantes_destino drop column if exists activo;

-- El panel edita la ficha de la campaña directamente (antes solo la leía la Lambda, con service_role).
grant select, insert, update on public.anunciantes_destino to authenticated;
create policy anunciantes_destino_lectura_admin on public.anunciantes_destino
  for select to authenticated using (public.es_admin());
create policy anunciantes_destino_alta_admin on public.anunciantes_destino
  for insert to authenticated with check (public.es_admin());
create policy anunciantes_destino_edicion_admin on public.anunciantes_destino
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Auditoría de cambios sensibles: por ahora solo email_destino, porque decide a dónde van los leads
-- de un cliente. Se rellena sola con un trigger (no depende de que el panel se acuerde de escribirla).
create table if not exists public.campanas_cambios (
  id              uuid primary key default gen_random_uuid(),
  anunciante_slug text not null references public.anunciantes_destino (slug),
  campo           text not null,
  valor_anterior  text,
  valor_nuevo     text,
  admin_email     text not null,
  creado_at       timestamptz not null default now()
);
create index if not exists campanas_cambios_slug_idx on public.campanas_cambios (anunciante_slug, creado_at desc);

comment on table public.campanas_cambios is
  'Auditoría de cambios sensibles en anunciantes_destino. Sin datos de leads: solo qué campaña, qué campo, quién y cuándo.';

alter table public.campanas_cambios enable row level security;
revoke all on public.campanas_cambios from anon, authenticated;
grant select on public.campanas_cambios to authenticated;
create policy campanas_cambios_lectura_admin on public.campanas_cambios
  for select to authenticated using (public.es_admin());

create or replace function public.registrar_cambio_email_destino()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_destino is distinct from old.email_destino then
    insert into public.campanas_cambios (anunciante_slug, campo, valor_anterior, valor_nuevo, admin_email)
    values (new.slug, 'email_destino', old.email_destino, new.email_destino,
            coalesce(auth.jwt() ->> 'email', 'desconocido'));
  end if;
  return new;
end;
$$;

drop trigger if exists campanas_auditar_email_destino on public.anunciantes_destino;
create trigger campanas_auditar_email_destino
  after update on public.anunciantes_destino
  for each row execute function public.registrar_cambio_email_destino();

-- Archivos de campaña (diseño del sobre, contrato firmado, etc.): bucket privado, sin enlaces públicos.
-- La descarga siempre pasa por el login del panel (RLS de storage.objects, misma comprobación es_admin()).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campanas-archivos', 'campanas-archivos', false, 15728640,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy campanas_archivos_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'campanas-archivos' and public.es_admin());
create policy campanas_archivos_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'campanas-archivos' and public.es_admin());
create policy campanas_archivos_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'campanas-archivos' and public.es_admin());
create policy campanas_archivos_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'campanas-archivos' and public.es_admin());
