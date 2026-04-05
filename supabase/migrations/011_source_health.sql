-- Track which RSS sources succeeded/failed on last pipeline run
-- Format: { "source-key": { "ok": true, "last_run": "ISO", "error": null } }
alter table app_settings
  add column if not exists source_health jsonb not null default '{}'::jsonb;
