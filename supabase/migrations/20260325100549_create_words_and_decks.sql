-- Decks table
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.decks enable row level security;

create policy "Users can manage their own decks"
  on public.decks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Words table
create table public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  language text not null check (language in ('EN', 'FR')),
  translations text[] not null default '{}',
  sentences_source text[] not null default '{}',
  sentences_german text[] not null default '{}',
  deck text not null,
  status text not null default 'pending' check (status in ('pending', 'exported')),
  created_at timestamptz not null default now(),
  exported_at timestamptz
);

alter table public.words enable row level security;

create policy "Users can manage their own words"
  on public.words
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for common queries
create index words_user_deck_status_idx on public.words(user_id, deck, status);
