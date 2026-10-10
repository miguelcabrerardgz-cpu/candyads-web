-- Candy Ads · rol «preventa» en el panel y registro de llamadas de preventa.
--
-- Hasta ahora todo email de panel_admins era administrador completo (campañas, email de destino de los
-- leads, contratos en Storage, CRM entero con importes). La persona de preventa entra con la cuenta
-- compartida equipo@candyads.es y solo debe ver la cola de llamadas.
--
-- 1. panel_admins.rol: 'admin' (todo, como hasta ahora) o 'preventa'.
-- 2. es_admin() — la función de TODAS las políticas RLS del panel (tablas y Storage) — exige además
--    rol = 'admin'. Una cuenta preventa no lee ni escribe campañas, leads, archivos ni crm_datos, aunque
--    llame a la API directamente.
-- 3. es_preventa(): cualquier cuenta del panel (admin o preventa) con doble factor. Da acceso SOLO a:
--    - preventa_cola(): proyección de las empresas prospecto del CRM (nombre, contacto, teléfonos, email,
--      dirección, municipio, sector y las notas de importación). Nunca pedidos, presupuestos, importes,
--      visitas ni el resto de notas.
--    - crm_preventa (lectura) y preventa_registrar()/preventa_deshacer() (escritura controlada).
-- 4. crm_preventa: una fila por empresa con el estado de preventa. Va APARTE del bloque ncrm_crm a
--    propósito: las llamadas de preventa no tocan ese bloque, así que no provocan conflictos de versión con
--    el admin que tenga el CRM abierto. Cada resultado guarda quién lo registró (email de la sesión) y el
--    nombre que escribió la persona; «deshacer» no borra, marca el resultado como anulado (auditoría).

alter table public.panel_admins add column if not exists rol text not null default 'admin';
do $$ begin
  alter table public.panel_admins add constraint panel_admins_rol_chk check (rol in ('admin', 'preventa'));
exception when duplicate_object then null; end $$;

update public.panel_admins set rol = 'preventa' where lower(email) = 'equipo@candyads.es';

-- Rol de la sesión (null si no está en panel_admins o no ha pasado el doble factor). Para que el panel
-- decida qué pestañas mostrar; no da acceso a ningún dato.
create or replace function public.panel_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.panel_admins
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.panel_rol() = 'admin', false);
$$;

create or replace function public.es_preventa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.panel_rol() is not null;
$$;

revoke all on function public.panel_rol() from public, anon;
revoke all on function public.es_admin() from public, anon;
revoke all on function public.es_preventa() from public, anon;
grant execute on function public.panel_rol() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_preventa() to authenticated;

-- ── Estado de preventa por empresa ─────────────────────────────────────────────────────────────────────
create table if not exists public.crm_preventa (
  cliente_id      integer primary key check (cliente_id > 0),  -- id de la empresa dentro de ncrm_crm
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente','no_contesta','volver','interesado','cita','no_interesado','erroneo','sin_respuesta')),
  intentos        integer not null default 0,
  ultima          timestamptz,
  proxima         date,
  resultados      jsonb not null default '[]'::jsonb,           -- [{ts, resultado, fecha, nota, operador, quien, anulado?...}]
  actualizado_at  timestamptz not null default now(),
  actualizado_por text not null
);
comment on table public.crm_preventa is
  'Llamadas de preventa por empresa del CRM. Lectura: es_preventa(). Escritura solo con preventa_registrar/preventa_deshacer.';

alter table public.crm_preventa enable row level security;
revoke all on public.crm_preventa from anon, authenticated;
grant select on public.crm_preventa to authenticated;
drop policy if exists crm_preventa_lectura on public.crm_preventa;
create policy crm_preventa_lectura on public.crm_preventa for select to authenticated using (public.es_preventa());

-- Empresas que entran en preventa: las que el CRM tiene como prospecto / pendiente de datos (o sin fase).
create or replace function public.preventa_cola()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  res jsonb;
begin
  if not public.es_preventa() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', (e ->> 'id')::integer,
           'nombre', e ->> 'nombre',
           'contacto', e ->> 'contacto',
           'telefono', e ->> 'telefono',
           'telefonoFijo', e ->> 'telefonoFijo',
           'email', e ->> 'email',
           'direccion', e ->> 'direccion',
           'cp', e ->> 'cp',
           'municipio', e ->> 'municipio',
           'provincia', e ->> 'provincia',
           'sector', e ->> 'sector',
           -- Solo las notas que dejó el importador (referencia, web, avisos como exclusividades).
           'notas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select case jsonb_typeof(n) when 'string' then n #>> '{}' else n ->> 'texto' end as t
                         from jsonb_array_elements(case jsonb_typeof(e -> 'notas') when 'array' then e -> 'notas' else '[]'::jsonb end) n
                     ) x where t like '%(importado)%')
         ) order by e ->> 'nombre'), '[]'::jsonb)
    into res
    from public.crm_datos d,
         jsonb_array_elements(d.valor::jsonb) e
   where d.clave = 'ncrm_crm'
     and jsonb_typeof(e -> 'id') = 'number'
     and (coalesce(e ->> 'pipeline', '') in ('', 'prospecto', 'pendiente-datos')
          or exists (select 1 from public.crm_preventa p where p.cliente_id = (e ->> 'id')::integer));
  return res;
end;
$$;

-- Recalcula estado/intentos/última/próxima a partir de los resultados no anulados.
create or replace function public.preventa_recalcular(p_res jsonb, out estado text, out intentos integer,
                                                      out ultima timestamptz, out proxima date)
language plpgsql
immutable
as $$
declare
  vivos jsonb;
  n integer;
  seguidos integer := 0;
  ult jsonb;
  i integer;
begin
  select coalesce(jsonb_agg(r order by ord), '[]'::jsonb) into vivos
    from jsonb_array_elements(p_res) with ordinality as a(r, ord)
   where not coalesce((r ->> 'anulado')::boolean, false);
  n := jsonb_array_length(vivos);
  intentos := n;
  if n = 0 then
    estado := 'pendiente'; ultima := null; proxima := null; return;
  end if;
  ult := vivos -> (n - 1);
  estado := ult ->> 'resultado';
  ultima := (ult ->> 'ts')::timestamptz;
  proxima := nullif(ult ->> 'fecha', '')::date;
  if estado = 'no_contesta' then
    i := n - 1;
    while i >= 0 and (vivos -> i ->> 'resultado') = 'no_contesta' loop
      seguidos := seguidos + 1; i := i - 1;
    end loop;
    if seguidos >= 5 then estado := 'sin_respuesta'; end if;
  end if;
end;
$$;

create or replace function public.preventa_registrar(p_cliente integer, p_resultado text, p_fecha date,
                                                     p_nota text, p_operador text)
returns public.crm_preventa
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.crm_preventa;
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  quien text := auth.jwt() ->> 'email';
  nota text := left(btrim(regexp_replace(coalesce(p_nota, ''), '[[:cntrl:]]+', ' ', 'g')), 300);
  operador text := left(btrim(regexp_replace(coalesce(p_operador, ''), '[[:cntrl:]]+', ' ', 'g')), 40);
  calc record;
begin
  if not public.es_preventa() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if p_resultado not in ('no_contesta','volver','interesado','cita','no_interesado','erroneo') then
    raise exception 'resultado no válido' using errcode = '22023';
  end if;
  if p_resultado in ('volver','cita') and (p_fecha is null or p_fecha < hoy or p_fecha > hoy + 365) then
    raise exception 'fecha no válida' using errcode = '22023';
  end if;
  if p_resultado not in ('volver','cita') then p_fecha := null; end if;
  -- La empresa tiene que estar en la cola (prospecto en el CRM o ya con preventa).
  if not exists (
       select 1 from public.crm_datos d, jsonb_array_elements(d.valor::jsonb) e
        where d.clave = 'ncrm_crm' and jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::integer = p_cliente
          and coalesce(e ->> 'pipeline', '') in ('', 'prospecto', 'pendiente-datos'))
     and not exists (select 1 from public.crm_preventa where cliente_id = p_cliente) then
    raise exception 'empresa fuera de preventa' using errcode = '22023';
  end if;

  insert into public.crm_preventa (cliente_id, actualizado_por) values (p_cliente, quien)
  on conflict (cliente_id) do nothing;
  select * into fila from public.crm_preventa where cliente_id = p_cliente for update;

  fila.resultados := fila.resultados || jsonb_build_array(jsonb_build_object(
    'ts', now(), 'resultado', p_resultado, 'fecha', p_fecha, 'nota', nota, 'operador', operador, 'quien', quien));
  -- Como mucho 100 resultados por empresa (los más recientes).
  if jsonb_array_length(fila.resultados) > 100 then
    select jsonb_agg(r order by ord) into fila.resultados
      from jsonb_array_elements(fila.resultados) with ordinality a(r, ord)
     where ord > jsonb_array_length(fila.resultados) - 100;
  end if;
  calc := public.preventa_recalcular(fila.resultados);

  update public.crm_preventa
     set resultados = fila.resultados, estado = calc.estado, intentos = calc.intentos,
         ultima = calc.ultima, proxima = calc.proxima, actualizado_at = now(), actualizado_por = quien
   where cliente_id = p_cliente
  returning * into fila;
  return fila;
end;
$$;

-- Anula el último resultado vigente (no lo borra: queda con anulado/anulado_por/anulado_at).
create or replace function public.preventa_deshacer(p_cliente integer)
returns public.crm_preventa
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.crm_preventa;
  quien text := auth.jwt() ->> 'email';
  idx integer;
  calc record;
begin
  if not public.es_preventa() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  select * into fila from public.crm_preventa where cliente_id = p_cliente for update;
  if not found then
    raise exception 'sin resultados' using errcode = '22023';
  end if;
  select max(ord) - 1 into idx
    from jsonb_array_elements(fila.resultados) with ordinality a(r, ord)
   where not coalesce((r ->> 'anulado')::boolean, false);
  if idx is null then
    raise exception 'sin resultados' using errcode = '22023';
  end if;
  fila.resultados := jsonb_set(fila.resultados, array[idx::text],
    (fila.resultados -> idx) || jsonb_build_object('anulado', true, 'anulado_por', quien, 'anulado_at', now()));
  calc := public.preventa_recalcular(fila.resultados);
  update public.crm_preventa
     set resultados = fila.resultados, estado = calc.estado, intentos = calc.intentos,
         ultima = calc.ultima, proxima = calc.proxima, actualizado_at = now(), actualizado_por = quien
   where cliente_id = p_cliente
  returning * into fila;
  return fila;
end;
$$;

revoke all on function public.preventa_cola() from public, anon;
revoke all on function public.preventa_recalcular(jsonb) from public, anon;
revoke all on function public.preventa_registrar(integer, text, date, text, text) from public, anon;
revoke all on function public.preventa_deshacer(integer) from public, anon;
grant execute on function public.preventa_cola() to authenticated;
grant execute on function public.preventa_registrar(integer, text, date, text, text) to authenticated;
grant execute on function public.preventa_deshacer(integer) to authenticated;

-- Comprobar después de aplicar:
--   select email, rol from panel_admins;   -- equipo@candyads.es → preventa; tu Gmail → admin
-- Dar o quitar el rol a otra cuenta:
--   update panel_admins set rol = 'preventa' where lower(email) = lower('...');   -- o 'admin'
