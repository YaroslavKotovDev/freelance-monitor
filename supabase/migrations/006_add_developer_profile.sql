-- Developer profile used by LLM to generate cover letters.
-- User fills this once in the admin panel.
alter table app_settings
  add column if not exists developer_profile text null;
