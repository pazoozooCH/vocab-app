-- Add deck_id column
alter table public.words add column deck_id uuid references public.decks(id) on delete cascade;

-- Populate deck_id from existing deck text matches
update public.words w
  set deck_id = d.id
  from public.decks d
  where w.deck = d.name and w.user_id = d.user_id;

-- Make deck_id required (all words should now have a deck_id)
alter table public.words alter column deck_id set not null;

-- Drop the old text column and index
drop index words_user_deck_status_idx;
alter table public.words drop column deck;

-- Create new index using deck_id
create index words_user_deck_status_idx on public.words(user_id, deck_id, status);
