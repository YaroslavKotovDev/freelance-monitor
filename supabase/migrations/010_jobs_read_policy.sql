-- Enable RLS on jobs (was missing) so the admin panel can read jobs
-- via the anon key + authenticated session.
-- The service role used by the pipeline bypasses RLS automatically.

alter table public.jobs enable row level security;

-- Authenticated users (admin web panel) can read all jobs
create policy "authenticated can read jobs"
  on public.jobs for select
  to authenticated
  using (true);
