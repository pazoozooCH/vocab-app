-- Generated columns for case-insensitive sorting
-- word_lower: lowercase of the word column for sorting
-- translation_lower: lowercase of the first translation for sorting
alter table public.words
  add column word_lower text generated always as (lower(word)) stored;

alter table public.words
  add column translation_lower text generated always as (lower(translations[1])) stored;

create index words_word_lower_idx on public.words(user_id, word_lower);
create index words_translation_lower_idx on public.words(user_id, translation_lower);
