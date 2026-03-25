-- Allowed users whitelist table
create table public.allowed_users (
  email text primary key
);

-- Allow anyone to read the whitelist (needed for RLS checks)
alter table public.allowed_users enable row level security;

create policy "Anyone can read allowed_users"
  on public.allowed_users
  for select
  using (true);

-- Helper function to check if the current user is whitelisted
create or replace function public.is_allowed_user()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.allowed_users
    where email = (select auth.jwt() ->> 'email')
  );
$$;

-- Update existing RLS policies on words and decks to also check the whitelist
drop policy "Users can manage their own words" on public.words;
create policy "Whitelisted users can manage their own words"
  on public.words
  for all
  using (auth.uid() = user_id and public.is_allowed_user())
  with check (auth.uid() = user_id and public.is_allowed_user());

drop policy "Users can manage their own decks" on public.decks;
create policy "Whitelisted users can manage their own decks"
  on public.decks
  for all
  using (auth.uid() = user_id and public.is_allowed_user())
  with check (auth.uid() = user_id and public.is_allowed_user());
