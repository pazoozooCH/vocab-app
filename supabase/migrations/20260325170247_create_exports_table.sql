create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'failed')),
  word_ids uuid[] not null default '{}',
  deck_filter text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.exports enable row level security;

create policy "Whitelisted users can manage their own exports"
  on public.exports
  for all
  using (auth.uid() = user_id and public.is_allowed_user())
  with check (auth.uid() = user_id and public.is_allowed_user());

create index exports_user_created_idx on public.exports(user_id, created_at desc);
