-- Candy Ads · configuración pública de campaña, servida por la Lambda (no por el navegador directamente).
-- Sustituye al JSON estático docs/data/anunciantes/<slug>.json como fuente para /lead/<slug>: así un
-- cambio de estado o de ficha desde el panel se refleja al instante, sin depender de la caché de 10
-- minutos de GitHub Pages ni de tocar el repo. Devuelve un único objeto (o null si el slug no existe),
-- incluso para campañas no activas: la Lambda decide qué parte de esto expone al público según el estado.
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
    'razon_social', razon_social,
    'cif', cif,
    'email_privacidad', email_privacidad
  )
  from public.anunciantes_destino
  where slug = p_slug;
$$;

revoke all on function public.config_publico_de(text) from public, anon, authenticated;
grant execute on function public.config_publico_de(text) to service_role;
