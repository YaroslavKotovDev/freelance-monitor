-- Move LLM config from GitHub Secrets to app_settings.
-- Users set these once via the admin panel.
alter table app_settings
  add column if not exists llm_provider text null,   -- 'openai' | 'openrouter'
  add column if not exists llm_api_key  text null,
  add column if not exists llm_model    text null;
