-- Aivoke 0006: avatar bucket. Clients may READ and DELETE their own folder only.
-- Uploads go through a server route that verifies magic bytes, re-encodes to 512px WebP,
-- and writes {user_id}/avatar.webp with the service role, so client-side checks cannot be bypassed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Public bucket: files are served by URL without a SELECT policy, so listing stays restricted.
