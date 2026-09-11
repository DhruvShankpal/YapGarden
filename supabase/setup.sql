-- Grow it out — Supabase setup.
-- Paste this whole file into the Supabase SQL editor and run it once.

create extension if not exists pgcrypto;

-- Who is allowed in. Everything else keys off this table.
create table if not exists public.members (
  email text primary key
);
alter table public.members enable row level security;

-- No policy on `members` means nobody can read or write it from the browser;
-- you manage it here in the dashboard. The function below runs as its owner,
-- so it can still check the table.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

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

-- Members see and write everything; everyone else sees nothing at all.
drop policy if exists gardens_read   on public.gardens;
drop policy if exists gardens_write  on public.gardens;
drop policy if exists gardens_update on public.gardens;
create policy gardens_read   on public.gardens for select using (public.is_member());
create policy gardens_write  on public.gardens for insert with check (public.is_member() and author = auth.uid());
create policy gardens_update on public.gardens for update using (public.is_member()) with check (public.is_member());

drop policy if exists gardens_delete on public.gardens;
create policy gardens_delete on public.gardens for delete using (public.is_member() and author = auth.uid());

drop policy if exists reactions_read  on public.reactions;
drop policy if exists reactions_write on public.reactions;
create policy reactions_read  on public.reactions for select using (public.is_member());
create policy reactions_write on public.reactions for insert with check (public.is_member() and author = auth.uid());

-- Private bucket for the recordings; the app reads them through signed URLs.
insert into storage.buckets (id, name, public)
values ('gardens', 'gardens', false)
on conflict (id) do nothing;

drop policy if exists gardens_audio_read  on storage.objects;
drop policy if exists gardens_audio_write on storage.objects;
create policy gardens_audio_read  on storage.objects for select
  using (bucket_id = 'gardens' and public.is_member());
create policy gardens_audio_write on storage.objects for insert
  with check (bucket_id = 'gardens' and public.is_member());
drop policy if exists gardens_audio_delete on storage.objects;
create policy gardens_audio_delete on storage.objects for delete
  using (bucket_id = 'gardens' and public.is_member());

-- ── who is allowed in ───────────────────────────────────────────────
insert into public.members (email) values
  ('dhruvshankpal@gmail.com')
on conflict (email) do nothing;

-- To let someone else in, run just this line with their address (any
-- provider). Until then they cannot sign in, though you can still record and
-- play back your own gardens.
--
--   insert into public.members (email) values ('their@address.com')
--   on conflict (email) do nothing;
