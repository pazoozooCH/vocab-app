-- Full-text search helper: checks word, translations, and optionally sentences
-- Returns true if the search term is found (case-insensitive)
create or replace function public.word_matches_search(
  w public.words,
  search_term text,
  include_sentences boolean default false
)
returns boolean
language sql
immutable
as $$
  select
    w.word ilike '%' || search_term || '%'
    or exists (
      select 1 from unnest(w.translations) t where t ilike '%' || search_term || '%'
    )
    or (include_sentences and (
      exists (select 1 from unnest(w.sentences_source) s where s ilike '%' || search_term || '%')
      or exists (select 1 from unnest(w.sentences_german) s where s ilike '%' || search_term || '%')
    ))
$$;
