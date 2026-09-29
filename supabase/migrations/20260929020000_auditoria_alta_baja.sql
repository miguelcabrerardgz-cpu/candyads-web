-- Candy Ads · la auditoría de email_destino (campanas_cambios) cubre también el alta y la baja de campañas.
-- Antes solo registraba UPDATE: crear una campaña (o borrarla y volver a crearla con otro destino) no dejaba
-- rastro. Ahora cada fila de campanas_cambios es una de estas:
--   campo = 'alta'          valor_nuevo = email_destino con el que se creó
--   campo = 'email_destino' valor_anterior → valor_nuevo
--   campo = 'baja'          valor_anterior = email_destino que tenía al borrarse
-- "Quién": el email del admin del panel; si el cambio no viene del panel, el rol (service_role para la
-- Lambda) o el usuario de base de datos (p. ej. postgres desde el SQL Editor), en vez de "desconocido".
-- Sigue siendo un trigger (no lógica del panel), en la misma transacción que el cambio: si el registro
-- fallara, el cambio tampoco se guarda y el panel muestra el error. A propósito: un cambio de a dónde van
-- datos personales no debe poder quedar sin rastro.
create or replace function public.registrar_cambio_email_destino()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quien text := coalesce(auth.jwt() ->> 'email', nullif(auth.jwt() ->> 'role', ''), session_user);
begin
  if tg_op = 'INSERT' then
    insert into public.campanas_cambios (anunciante_slug, campo, valor_anterior, valor_nuevo, admin_email)
    values (new.slug, 'alta', null, new.email_destino, quien);
  elsif tg_op = 'DELETE' then
    insert into public.campanas_cambios (anunciante_slug, campo, valor_anterior, valor_nuevo, admin_email)
    values (old.slug, 'baja', old.email_destino, null, quien);
    return old;
  elsif new.email_destino is distinct from old.email_destino then
    insert into public.campanas_cambios (anunciante_slug, campo, valor_anterior, valor_nuevo, admin_email)
    values (new.slug, 'email_destino', old.email_destino, new.email_destino, quien);
  end if;
  return new;
end;
$$;

drop trigger if exists campanas_auditar_email_destino on public.anunciantes_destino;
create trigger campanas_auditar_email_destino
  after insert or update or delete on public.anunciantes_destino
  for each row execute function public.registrar_cambio_email_destino();

comment on table public.campanas_cambios is
  'Auditoría del email de destino de cada campaña: alta, cambios y baja (quién y cuándo). Sin datos de leads. Solo la escribe el trigger campanas_auditar_email_destino.';
