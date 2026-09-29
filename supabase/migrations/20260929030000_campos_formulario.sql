-- Candy Ads · campos del formulario público editables por campaña.
-- campos_formulario: array de {key, label, tipo, obligatorio, opciones?}, tipos text|textarea|tel|email|
-- numero|fecha|select|checkbox. NULL = la campaña sigue con la lista antigua de claves ("campos"), que la
-- Lambda y formulario.js traducen igual que antes: así ninguna campaña existente cambia hasta que alguien
-- edita sus campos en la ficha del panel. La validación de cada campo la hace la Lambda (campos.mjs).
alter table public.anunciantes_destino
  add column if not exists campos_formulario jsonb
    check (campos_formulario is null or jsonb_typeof(campos_formulario) = 'array');

-- Igual que en 20260929000000_logo_escala.sql, más campos_formulario. Sigue sin exponer email_destino: la
-- lectura pública pasa solo por la Lambda (/config), que elige a mano qué devuelve.
create or replace function public.config_publico_de(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'estado', estado,
    'nombre_mostrado', nombre_mostrado,
    'campos', coalesce(campos, '[]'::jsonb),
    'campos_formulario', campos_formulario,
    'tema_color', tema_color,
    'tema_color_secundario', tema_color_secundario,
    'tema_logo', tema_logo,
    'logo_landing_escala', logo_landing_escala,
    'razon_social', razon_social,
    'cif', cif,
    'email_privacidad', email_privacidad
  )
  from public.anunciantes_destino
  where slug = p_slug;
$$;

revoke all on function public.config_publico_de(text) from public, anon, authenticated;
grant execute on function public.config_publico_de(text) to service_role;
