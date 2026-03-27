-- Track API usage for statistics
create table public.api_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  success boolean not null,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.api_usage enable row level security;

create policy "Whitelisted users can read their own usage"
  on public.api_usage
  for select
  using (auth.uid() = user_id and public.is_allowed_user());

create policy "Whitelisted users can insert their own usage"
  on public.api_usage
  for insert
  with check (auth.uid() = user_id and public.is_allowed_user());

create index api_usage_user_created_idx on public.api_usage(user_id, created_at desc);
create index api_usage_user_model_idx on public.api_usage(user_id, model);
