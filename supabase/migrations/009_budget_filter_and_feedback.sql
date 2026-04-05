-- Budget filter: min budget threshold in app_settings
alter table app_settings
  add column if not exists min_budget_usd int not null default 0;

-- Job feedback: learn from Взяти/Сховати reactions
-- user_action: 'taken' | 'hidden'
alter table public.jobs
  add column if not exists user_action text null,
  add column if not exists user_action_at timestamptz null;

-- Index for feedback analytics
create index if not exists idx_jobs_user_action on public.jobs(user_action) where user_action is not null;
