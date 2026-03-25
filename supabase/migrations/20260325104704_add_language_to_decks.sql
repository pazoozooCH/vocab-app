alter table public.decks
  add column language text not null default 'EN' check (language in ('EN', 'FR'));

-- Remove default after backfill
alter table public.decks alter column language drop default;
