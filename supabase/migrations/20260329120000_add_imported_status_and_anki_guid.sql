-- Add 'imported' to the allowed status values for words
-- Drop the old constraint and add a new one that includes 'imported'
alter table public.words drop constraint if exists words_status_check;
alter table public.words add constraint words_status_check check (status in ('pending', 'exported', 'imported'));

-- Add anki_guid column for tracking imported Anki notes
alter table public.words add column if not exists anki_guid text;

-- Unique constraint: one anki_guid per user (prevents duplicate imports)
create unique index if not exists words_user_anki_guid_unique on public.words(user_id, anki_guid) where anki_guid is not null;
