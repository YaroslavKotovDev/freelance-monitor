-- ─── app_settings: single-row config table ────────────────────────────────────
create table if not exists app_settings (
  id              int         primary key default 1,
  is_bot_active   boolean     not null default false,
  stop_words      jsonb       not null default '[]'::jsonb,
  min_score       int         not null default 75,
  active_sources  jsonb       not null default '[]'::jsonb,
  updated_at      timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- Auto-update updated_at on every write
create or replace function update_app_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_settings_updated_at on app_settings;
create trigger app_settings_updated_at
  before update on app_settings
  for each row execute procedure update_app_settings_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table app_settings enable row level security;

-- Service role (used by the pipeline via SUPABASE_SERVICE_ROLE_KEY) bypasses RLS
-- automatically — no policy needed for it.

-- Authenticated users (admin web panel) can read the settings row
create policy "authenticated can read settings"
  on app_settings for select
  to authenticated
  using (true);

-- Authenticated users can update the settings row
create policy "authenticated can update settings"
  on app_settings for update
  to authenticated
  using (true)
  with check (true);

-- ─── Default row ──────────────────────────────────────────────────────────────
insert into app_settings (id, is_bot_active, stop_words, min_score, active_sources)
values (
  1,
  false,
  '[
    "казино",
    "wordpress",
    "реферат",
    "диплом",
    "курсова",
    "есе",
    "full-time",
    "full time",
    "fulltime",
    "part-time",
    "фуллтайм",
    "в штат",
    "постійна робота",
    "постоянная работа",
    "long-term",
    "long term",
    "довгостроков",
    "долгосрочн",
    "looking for someone to join",
    "join our team permanently",
    "permanent position",
    "permanent role"
  ]'::jsonb,
  75,
  '["freelancer-js", "freelancer-html", "freelancer-react", "reddit-forhire"]'::jsonb
)
on conflict (id) do nothing;
