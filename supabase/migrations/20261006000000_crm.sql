-- Candy Ads · datos del CRM del panel (docs/crm, pestaña "CRM").
--
-- El CRM guarda sus datos como pares clave → texto (lo que antes era su localStorage): ncrm_crm (todas las
-- empresas con sus notas, llamadas, visitas, pedidos y recordatorios), ncrm_plantillas, ncrm_papelera,
-- ncrm_docs_<cliente>_<tipo> (PDF adjuntos), ncrm_cuota, ncrm_theme. Contiene datos personales de contactos
-- comerciales: solo los admins del panel con doble factor (es_admin()) pueden leerlos o escribirlos.
--
-- Concurrencia: cada fila lleva version. crm_guardar() solo escribe si la versión que tenía el navegador
-- sigue siendo la actual; si otro admin guardó entretanto devuelve -1 y el panel avisa en vez de pisarlo.
-- Historial: copia de la versión anterior como mucho cada 10 minutos por clave (y siempre al borrar), las 50
-- últimas, para recuperar un borrado accidental. Los PDF (ncrm_docs_*) no entran en el historial.

create table if not exists public.crm_datos (
  clave           text primary key check (clave ~ '^ncrm_(crm|plantillas|papelera|cuota|theme|docs_[A-Za-z0-9_-]+)$'),
  valor           text not null,
  version         integer not null default 1,
  actualizado_at  timestamptz not null default now(),
  actualizado_por text not null
);

create table if not exists public.crm_historial (
  id            bigserial primary key,
  clave         text not null,
  valor         text not null,
  version       integer not null,
  guardado_at   timestamptz not null,
  guardado_por  text not null,
  sustituido_at timestamptz not null default now(),
  motivo        text not null check (motivo in ('cambio', 'borrado'))
);
create index if not exists crm_historial_clave_idx on public.crm_historial (clave, id desc);

comment on table public.crm_datos is
  'CRM del panel: datos de contactos comerciales. Solo admins con doble factor (es_admin). Escritura con crm_guardar() (control de versión).';
comment on table public.crm_historial is
  'Versiones anteriores de crm_datos (máx. una cada 10 min por clave, 50 por clave; siempre al borrar). Solo lectura para admins; lo escribe un trigger.';

alter table public.crm_datos enable row level security;
alter table public.crm_historial enable row level security;
revoke all on public.crm_datos, public.crm_historial from anon, authenticated;
grant select, delete on public.crm_datos to authenticated;
grant select on public.crm_historial to authenticated;
revoke all on sequence public.crm_historial_id_seq from anon, authenticated;

create policy crm_datos_lectura_admin on public.crm_datos for select to authenticated using (public.es_admin());
create policy crm_datos_borrado_admin on public.crm_datos for delete to authenticated using (public.es_admin());
create policy crm_historial_lectura_admin on public.crm_historial for select to authenticated using (public.es_admin());

-- Guardar con control de versión. p_version = la versión que tenía el navegador (0 = la clave aún no existía).
-- Devuelve la versión nueva, o -1 si otro guardado se adelantó. SECURITY DEFINER con la comprobación de
-- es_admin() dentro: así la tabla no necesita permisos de insert/update para nadie más que esta función.
create or replace function public.crm_guardar(p_clave text, p_valor text, p_version integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  if not public.es_admin() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_version = 0 then
    insert into public.crm_datos (clave, valor, version, actualizado_por)
    values (p_clave, p_valor, 1, auth.jwt() ->> 'email')
    on conflict (clave) do nothing
    returning version into v;
  else
    update public.crm_datos
       set valor = p_valor, version = version + 1, actualizado_at = now(), actualizado_por = auth.jwt() ->> 'email'
     where clave = p_clave and version = p_version
    returning version into v;
  end if;
  return coalesce(v, -1);
end;
$$;
revoke all on function public.crm_guardar(text, text, integer) from public, anon;
grant execute on function public.crm_guardar(text, text, integer) to authenticated;

create or replace function public.crm_guardar_historial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.clave ~ '^ncrm_docs_' then
    return null;
  end if;
  if tg_op = 'DELETE' or not exists (
    select 1 from public.crm_historial
     where clave = old.clave and sustituido_at > now() - interval '10 minutes'
  ) then
    insert into public.crm_historial (clave, valor, version, guardado_at, guardado_por, motivo)
    values (old.clave, old.valor, old.version, old.actualizado_at, old.actualizado_por,
            case when tg_op = 'DELETE' then 'borrado' else 'cambio' end);
    delete from public.crm_historial
     where clave = old.clave
       and id not in (select id from public.crm_historial where clave = old.clave order by id desc limit 50);
  end if;
  return null;
end;
$$;

drop trigger if exists crm_datos_historial on public.crm_datos;
create trigger crm_datos_historial
  after update or delete on public.crm_datos
  for each row execute function public.crm_guardar_historial();

-- Recuperar una versión anterior (SQL Editor): mirar
--   select id, clave, version, guardado_at, guardado_por, motivo, length(valor) from crm_historial order by id desc;
-- y restaurar con
--   update crm_datos set valor = (select valor from crm_historial where id = <ID>), version = version + 1,
--     actualizado_at = now(), actualizado_por = 'restaurado' where clave = '<CLAVE>';
-- (si la clave se había borrado: insert into crm_datos (clave, valor, actualizado_por) select clave, valor, 'restaurado' from crm_historial where id = <ID>;)
-- Con el CRM cerrado en todos los navegadores, o al volver a abrirlo cargará la versión restaurada.
