-- Make Data API grants explicit on existing public tables.
--
-- Background: until Oct 30, 2026 Supabase auto-grants anon/authenticated/service_role
-- on tables created in `public` via default privileges. After that cutover the implicit
-- grants are no longer applied to NEW tables, and we'd rather not depend on the legacy
-- default-privilege mechanism for these existing tables either. This migration pins the
-- grants explicitly so access is identical and durable.
--
-- This is privilege metadata only — it touches no rows and is idempotent (re-granting a
-- privilege the role already holds is a no-op). RLS (already enabled on every table below)
-- remains the actual row-level access control; these grants only restore table-level reach.

grant select, insert, update, delete on public.decks         to anon, authenticated, service_role;
grant select, insert, update, delete on public.words         to anon, authenticated, service_role;
grant select, insert, update, delete on public.allowed_users to anon, authenticated, service_role;
grant select, insert, update, delete on public.exports       to anon, authenticated, service_role;
grant select, insert, update, delete on public.api_usage     to anon, authenticated, service_role;
