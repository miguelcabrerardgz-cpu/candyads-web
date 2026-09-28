-- Candy Ads · doble factor (TOTP) obligatorio para el panel interno.
--
-- es_admin() — la función que usan TODAS las políticas RLS del panel (tablas y Storage) — pasa a exigir,
-- además de que el email esté en panel_admins, que la sesión sea de nivel aal2: contraseña + código de la
-- app de autenticación. Así el segundo factor no es solo una pantalla del panel: una sesión solo con
-- contraseña (aal1) no puede leer ni escribir nada aunque llame a la API directamente.
--
-- El mecanismo de restricción por email no cambia: sigue siendo panel_admins. es_admin_email() es esa misma
-- comprobación de siempre, sin el requisito de aal2, para que el panel pueda decir "esta cuenta no tiene
-- acceso" antes de pedir el segundo factor a alguien que no es admin. No da acceso a ningún dato.
--
-- La Lambda usa la secret key (service_role, fuera de RLS): no le afecta.

create or replace function public.es_admin_email()
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

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin_email() and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.es_admin_email() from public, anon;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin_email() to authenticated;
grant execute on function public.es_admin() to authenticated;

-- Recuperación si un admin pierde el móvil (ejecutar a mano en el SQL Editor, cambiando el email):
--   delete from auth.mfa_factors
--   where user_id = (select id from auth.users where lower(email) = lower('ADMIN@EJEMPLO.COM'));
-- En su siguiente login el panel le pedirá volver a inscribir la app.
