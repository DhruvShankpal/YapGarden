-- Open it up: anyone with the link, no sign-in screen.
-- The page signs itself in anonymously, so every visitor is still a real user
-- with an id — that is what keeps "yours" apart from "theirs", and stops one
-- person deleting another's yaps. Writing still requires that session; the
-- publishable key alone gets you nothing.
--
-- Before running this, turn anonymous sign-ins on:
--   Authentication -> Sign In / Providers -> Anonymous sign-ins -> enable.

-- gardens
drop policy if exists gardens_read   on public.gardens;
drop policy if exists gardens_write  on public.gardens;
drop policy if exists gardens_update on public.gardens;
drop policy if exists gardens_delete on public.gardens;
create policy gardens_read   on public.gardens for select using (true);
create policy gardens_write  on public.gardens for insert with check (auth.uid() is not null and author = auth.uid());
create policy gardens_update on public.gardens for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy gardens_delete on public.gardens for delete using (author = auth.uid());

-- reactions
drop policy if exists reactions_read  on public.reactions;
drop policy if exists reactions_write on public.reactions;
create policy reactions_read  on public.reactions for select using (true);
create policy reactions_write on public.reactions for insert with check (auth.uid() is not null and author = auth.uid());

-- recordings
drop policy if exists gardens_audio_read   on storage.objects;
drop policy if exists gardens_audio_write  on storage.objects;
drop policy if exists gardens_audio_delete on storage.objects;
create policy gardens_audio_read   on storage.objects for select
  using (bucket_id = 'gardens');
create policy gardens_audio_write  on storage.objects for insert
  with check (bucket_id = 'gardens' and auth.uid() is not null);
create policy gardens_audio_delete on storage.objects for delete
  using (bucket_id = 'gardens' and auth.uid() is not null);

-- the allowlist is no longer consulted by anything
drop function if exists public.is_member();
drop table if exists public.members;
