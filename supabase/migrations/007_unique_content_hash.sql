-- Add unique constraint on content_hash to prevent duplicate jobs
-- with slightly different URLs but identical content from being sent to Telegram.
-- content_hash is SHA-256 of (source + title + description[:500] + budget).

-- Drop existing plain index first, the unique constraint replaces it
drop index if exists public.idx_jobs_content_hash;

alter table public.jobs
  add constraint jobs_content_hash_key unique (content_hash);
