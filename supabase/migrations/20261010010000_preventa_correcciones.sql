-- Candy Ads · Preventa corrige datos de contacto (persona de contacto, móvil, fijo, email) y quedan en la ficha.
--
-- La cuenta preventa sigue sin poder escribir en el bloque del CRM (crm_datos.ncrm_crm): eso provocaría
-- conflictos de versión con el admin que tenga el CRM abierto. En su lugar:
--   1. preventa_corregir() guarda la corrección en crm_preventa.cambios (el último valor de cada campo, con
--      valor anterior, quién y cuándo) y la añade a crm_preventa.cambios_log (todas, para auditoría).
--   2. preventa_cola() ya devuelve el dato corregido mientras no se haya pasado a la ficha.
--   3. Cuando el admin abre el CRM, el propio CRM aplica las correcciones pendientes a la ficha, deja una nota
--      «Preventa actualizó …» con el valor anterior y marca en la empresa preventaAplicado[campo] = ts. Esa
--      marca viaja en el mismo guardado que el cambio: si el guardado falla, la corrección se vuelve a aplicar
--      la próxima vez; si el admin luego cambia el dato a mano, la corrección ya aplicada no se repite.

alter table public.crm_preventa add column if not exists cambios jsonb not null default '{}'::jsonb;
alter table public.crm_preventa add column if not exists cambios_log jsonb not null default '[]'::jsonb;

-- Valor vigente de un campo de contacto: la corrección de preventa si aún no se ha pasado a la ficha; si no, la ficha.
create or replace function public.preventa_valor(e jsonb, cambios jsonb, campo text)
returns text
language sql
immutable
as $$
  select case
    when cambios ? campo and coalesce(e -> 'preventaAplicado' ->> campo, '') <> coalesce(cambios -> campo ->> 'ts', '')
      then cambios -> campo ->> 'valor'
    else coalesce(e ->> campo, '')
  end;
$$;

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
           'contacto', public.preventa_valor(e, coalesce(p.cambios, '{}'::jsonb), 'contacto'),
           'telefono', public.preventa_valor(e, coalesce(p.cambios, '{}'::jsonb), 'telefono'),
           'telefonoFijo', public.preventa_valor(e, coalesce(p.cambios, '{}'::jsonb), 'telefonoFijo'),
           'email', public.preventa_valor(e, coalesce(p.cambios, '{}'::jsonb), 'email'),
           'direccion', e ->> 'direccion',
           'cp', e ->> 'cp',
           'municipio', e ->> 'municipio',
           'provincia', e ->> 'provincia',
           'sector', e ->> 'sector',
           'notas', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select case jsonb_typeof(n) when 'string' then n #>> '{}' else n ->> 'texto' end as t
                         from jsonb_array_elements(case jsonb_typeof(e -> 'notas') when 'array' then e -> 'notas' else '[]'::jsonb end) n
                     ) x where t like '%(importado)%')
         ) order by e ->> 'nombre'), '[]'::jsonb)
    into res
    from public.crm_datos d
    cross join lateral jsonb_array_elements(d.valor::jsonb) e
    left join public.crm_preventa p on p.cliente_id = case when jsonb_typeof(e -> 'id') = 'number' then (e ->> 'id')::integer end
   where d.clave = 'ncrm_crm'
     and jsonb_typeof(e -> 'id') = 'number'
     and (coalesce(e ->> 'pipeline', '') in ('', 'prospecto', 'pendiente-datos') or p.cliente_id is not null);
  return res;
end;
$$;

-- p_datos: {"contacto": "...", "telefono": "...", "telefonoFijo": "...", "email": "..."} (solo los que cambian;
-- cadena vacía = borrar el dato). Devuelve la fila de crm_preventa.
create or replace function public.preventa_corregir(p_cliente integer, p_datos jsonb, p_operador text)
returns public.crm_preventa
language plpgsql
security definer
set search_path = public
as $$
declare
  emp jsonb;
  fila public.crm_preventa;
  quien text := auth.jwt() ->> 'email';
  operador text := left(btrim(regexp_replace(coalesce(p_operador, ''), '[[:cntrl:]]+', ' ', 'g')), 40);
  campo text;
  valor text;
  anterior text;
  cambio jsonb;
  hubo boolean := false;
begin
  if not public.es_preventa() then
    raise exception 'sin permiso' using errcode = '42501';
  end if;
  if jsonb_typeof(p_datos) <> 'object' then
    raise exception 'datos no válidos' using errcode = '22023';
  end if;
  select e into emp
    from public.crm_datos d, jsonb_array_elements(d.valor::jsonb) e
   where d.clave = 'ncrm_crm' and jsonb_typeof(e -> 'id') = 'number' and (e ->> 'id')::integer = p_cliente;
  if emp is null or not (coalesce(emp ->> 'pipeline', '') in ('', 'prospecto', 'pendiente-datos')
                         or exists (select 1 from public.crm_preventa where cliente_id = p_cliente)) then
    raise exception 'empresa fuera de preventa' using errcode = '22023';
  end if;

  insert into public.crm_preventa (cliente_id, actualizado_por) values (p_cliente, quien)
  on conflict (cliente_id) do nothing;
  select * into fila from public.crm_preventa where cliente_id = p_cliente for update;

  for campo in select jsonb_object_keys(p_datos) loop
    if campo not in ('contacto', 'telefono', 'telefonoFijo', 'email') then
      raise exception 'campo no válido' using errcode = '22023';
    end if;
    valor := btrim(regexp_replace(coalesce(p_datos ->> campo, ''), '[[:cntrl:]]+', ' ', 'g'));
    if campo in ('telefono', 'telefonoFijo') then
      valor := regexp_replace(valor, '[\s.-]', '', 'g');
      if valor <> '' and valor !~ '^\+?[0-9]{9,15}$' then
        raise exception 'teléfono no válido' using errcode = '22023';
      end if;
    elsif campo = 'email' then
      valor := lower(valor);
      if valor <> '' and (length(valor) > 120 or valor !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
        raise exception 'email no válido' using errcode = '22023';
      end if;
    elsif length(valor) > 80 then
      raise exception 'contacto demasiado largo' using errcode = '22023';
    end if;
    anterior := public.preventa_valor(emp, fila.cambios, campo);
    if valor is distinct from anterior then
      cambio := jsonb_build_object('campo', campo, 'valor', valor, 'anterior', anterior, 'ts', now(),
                                   'quien', quien, 'operador', operador);
      fila.cambios := fila.cambios || jsonb_build_object(campo, cambio);
      fila.cambios_log := fila.cambios_log || jsonb_build_array(cambio);
      hubo := true;
    end if;
  end loop;

  if not hubo then
    return fila;
  end if;
  if jsonb_array_length(fila.cambios_log) > 200 then
    select jsonb_agg(r order by ord) into fila.cambios_log
      from jsonb_array_elements(fila.cambios_log) with ordinality a(r, ord)
     where ord > jsonb_array_length(fila.cambios_log) - 200;
  end if;
  update public.crm_preventa
     set cambios = fila.cambios, cambios_log = fila.cambios_log, actualizado_at = now(), actualizado_por = quien
   where cliente_id = p_cliente
  returning * into fila;
  return fila;
end;
$$;

revoke all on function public.preventa_valor(jsonb, jsonb, text) from public, anon;
revoke all on function public.preventa_cola() from public, anon;
revoke all on function public.preventa_corregir(integer, jsonb, text) from public, anon;
grant execute on function public.preventa_cola() to authenticated;
grant execute on function public.preventa_corregir(integer, jsonb, text) to authenticated;
