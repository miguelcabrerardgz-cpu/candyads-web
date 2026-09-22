-- Candy Ads · confirmación de venta por el anunciante.
-- El anunciante confirma con un clic desde el propio correo del lead si ese contacto terminó en venta.
-- Se identifica solo por la referencia aleatoria (uuid) que ya usa el sistema de trazabilidad: no añade
-- ningún dato de la persona, solo dice si ESE envío concreto se convirtió.

alter table public.leads_registro
  add column if not exists conversion text not null default 'pendiente'
    check (conversion in ('pendiente', 'venta', 'sin_venta'));
alter table public.leads_registro
  add column if not exists conversion_at timestamptz;

comment on column public.leads_registro.conversion is
  'Confirmado por el anunciante con un clic desde el correo, sin login. No es un dato del lead.';

-- Marca el resultado. Se puede llamar más de una vez (el anunciante puede cambiar de opinión).
-- Devuelve false si la referencia no existe (enlace manipulado, o de otro entorno) o el valor no es válido.
create or replace function public.marcar_conversion(p_ref uuid, p_conversion text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_conversion not in ('venta', 'sin_venta') then
    return false;
  end if;

  update public.leads_registro
  set conversion = p_conversion, conversion_at = now()
  where ref = p_ref;

  return found;
end;
$$;

revoke all on function public.marcar_conversion(uuid, text) from public, anon, authenticated;
grant execute on function public.marcar_conversion(uuid, text) to service_role;
