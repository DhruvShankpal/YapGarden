-- Run this once if you already ran setup.sql.
-- Drops the two-person role columns: who sent a garden is now just its author,
-- and "yours" versus "theirs" is worked out from who is signed in.

alter table public.gardens   drop column if exists from_role;
alter table public.gardens   drop column if exists to_role;
alter table public.reactions drop column if exists from_role;
