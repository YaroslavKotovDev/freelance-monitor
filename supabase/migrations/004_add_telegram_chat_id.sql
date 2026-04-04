-- Add telegram_chat_id to app_settings.
-- Set when the user sends /start to the bot — no manual input needed.
alter table app_settings
  add column if not exists telegram_chat_id bigint null;
