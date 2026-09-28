-- Candy Ads · tamaño del logo del anunciante en /lead/<slug>, ajustable por campaña desde el panel.
-- Porcentaje sobre el tamaño base de lead.css (100 = tamaño base). La Lambda lo publica como tema.logo_escala.
alter table public.anunciantes_destino
  add column if not exists logo_landing_escala integer not null default 100
    check (logo_landing_escala between 50 and 200);

-- Igual que en 20260923020000_config_publico.sql, más logo_landing_escala.
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
