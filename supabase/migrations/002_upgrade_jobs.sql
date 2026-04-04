-- Migration 002: Upgrade jobs table to full architecture spec

alter table public.jobs
  -- rename budget to budget_text
  rename column budget to budget_text;

alter table public.jobs
  add column if not exists canonical_url       text null,
  add column if not exists budget_amount       numeric null,
  add column if not exists budget_currency     text null,
  add column if not exists location            text null,
  add column if not exists source_published_at timestamptz null,
  add column if not exists content_hash        text null,
  add column if not exists telegram_message_id text null,
  add column if not exists telegram_chat_id    text null,
  add column if not exists attempt_count       int not null default 0,
  add column if not exists last_error          text null,
  add column if not exists locked_at           timestamptz null,
  add column if not exists next_retry_at       timestamptz null,
  add column if not exists updated_at          timestamptz not null default now();

-- Indexes
create index if not exists idx_jobs_status_retry      on public.jobs(status, next_retry_at);
create index if not exists idx_jobs_created_at        on public.jobs(created_at desc);
create index if not exists idx_jobs_source_created_at on public.jobs(source, created_at desc);
create index if not exists idx_jobs_content_hash      on public.jobs(content_hash);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
