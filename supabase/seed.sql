-- Seed allowed users for local development
insert into public.allowed_users (email) values
  ('meyer80@gmail.com'),
  ('test@test.local'),
  ('e2e@test.local')
on conflict (email) do nothing;
