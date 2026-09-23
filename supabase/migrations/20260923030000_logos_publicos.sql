-- Candy Ads · logos de campaña subidos desde el panel (sin pasar por el repo).
-- Hasta ahora tema_logo solo aceptaba una ruta relativa a un archivo ya commiteado en
-- docs/assets/anunciantes/ (el logo de lacasa-piloto sigue así, se conserva). Añadimos un bucket
-- PÚBLICO (a diferencia de campanas-archivos, que es privado) para que /lead/<slug> pueda cargar la
-- imagen directamente, sin login: solo lectura pública, escritura restringida a panel_admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'anunciantes-logos', 'anunciantes-logos', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy anunciantes_logos_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'anunciantes-logos' and public.es_admin());
create policy anunciantes_logos_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'anunciantes-logos' and public.es_admin());
create policy anunciantes_logos_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'anunciantes-logos' and public.es_admin());
-- Sin policy de select: el bucket es público, Supabase sirve /storage/v1/object/public/... sin
-- comprobar RLS. Nadie anónimo puede escribir ahí (solo las tres policies de arriba, admin-only).

-- tema_logo pasa a aceptar también la URL pública de este bucket, además de la ruta del repo.
do $$
declare
  c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.anunciantes_destino'::regclass
      and pg_get_constraintdef(oid) like '%tema_logo%';
  if c is not null then
    execute format('alter table public.anunciantes_destino drop constraint %I', c);
  end if;
end $$;

alter table public.anunciantes_destino
  add constraint anunciantes_destino_tema_logo_check check (
    tema_logo is null
    or tema_logo ~ '^/assets/anunciantes/[a-z0-9._-]+\.(png|svg|jpg|jpeg|webp)$'
    or tema_logo ~ '^https://eceqcveqsbcfbmbaczed\.supabase\.co/storage/v1/object/public/anunciantes-logos/.+\.(png|svg|jpg|jpeg|webp)$'
  );
