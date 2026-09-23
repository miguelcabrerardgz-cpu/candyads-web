-- Candy Ads · corrige "new row violates row-level security policy" al subir un logo.
-- La lectura pública anónima (/storage/v1/object/public/...) no pasa por RLS, pero la SUBIDA sí va
-- por la ruta autenticada, y con x-upsert Storage necesita poder comprobar (select) si el archivo ya
-- existe antes de decidir insert vs update. Faltaba esa policy — solo había insert/update/delete.
create policy anunciantes_logos_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'anunciantes-logos' and public.es_admin());
