-- Grow it out — Supabase setup.
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Anyone with the link can use the app. The page signs itself in anonymously,
-- so each visitor is still a real user with an id, which is what separates
-- "yours" from "theirs" and stops one person deleting another's yaps.
-- Turn anonymous sign-ins on first:
--   Authentication -> Sign In / Providers -> Anonymous sign-ins -> enable.

create extension if not exists pgcrypto;

create table if not exists public.gardens (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  duration_ms  integer not null default 0,
  mime         text not null default 'audio/webm',
  audio_path   text not null,
  plants       jsonb not null default '[]'::jsonb,
  seen_at      timestamptz,
  reactions_seen_at timestamptz,
  author       uuid not null default auth.uid() references auth.users (id) on delete cascade
);

create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  garden_id  uuid not null references public.gardens (id) on delete cascade,
  emoji      text not null,
  kind       text not null default 'emoji',
  t          integer not null default 0,
  x          double precision not null default 0.5,
  y          double precision not null default 0.5,
  created_at timestamptz not null default now(),
  author     uuid not null default auth.uid() references auth.users (id) on delete cascade
);

create index if not exists gardens_created_idx on public.gardens (created_at desc);
create index if not exists reactions_garden_idx on public.reactions (garden_id);

alter table public.gardens   enable row level security;
alter table public.reactions enable row level security;

-- Anyone can read. Writing needs a session, and you can only delete your own.
drop policy if exists gardens_read   on public.gardens;
drop policy if exists gardens_write  on public.gardens;
drop policy if exists gardens_update on public.gardens;
drop policy if exists gardens_delete on public.gardens;
create policy gardens_read   on public.gardens for select using (true);
create policy gardens_write  on public.gardens for insert with check (auth.uid() is not null and author = auth.uid());
create policy gardens_update on public.gardens for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy gardens_delete on public.gardens for delete using (author = auth.uid());

drop policy if exists reactions_read  on public.reactions;
drop policy if exists reactions_write on public.reactions;
create policy reactions_read  on public.reactions for select using (true);
create policy reactions_write on public.reactions for insert with check (auth.uid() is not null and author = auth.uid());

-- Private bucket for the recordings; the app reads them through signed URLs.
insert into storage.buckets (id, name, public)
values ('gardens', 'gardens', false)
on conflict (id) do nothing;

drop policy if exists gardens_audio_read  on storage.objects;
drop policy if exists gardens_audio_write on storage.objects;
create policy gardens_audio_read  on storage.objects for select
  using (bucket_id = 'gardens');
create policy gardens_audio_write on storage.objects for insert
  with check (bucket_id = 'gardens' and auth.uid() is not null);
drop policy if exists gardens_audio_delete on storage.objects;
create policy gardens_audio_delete on storage.objects for delete
  using (bucket_id = 'gardens' and auth.uid() is not null);
