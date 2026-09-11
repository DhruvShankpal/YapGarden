-- Run this once to allow deleting yaps.
-- You can only delete your own; reactions go with the garden by cascade.

drop policy if exists gardens_delete on public.gardens;
create policy gardens_delete on public.gardens for delete
  using (public.is_member() and author = auth.uid());

drop policy if exists gardens_audio_delete on storage.objects;
create policy gardens_audio_delete on storage.objects for delete
  using (bucket_id = 'gardens' and public.is_member());
