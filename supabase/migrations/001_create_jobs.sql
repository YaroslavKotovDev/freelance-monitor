create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title text not null,
  description text not null,
  budget text null,
  status text not null default 'new',
  raw_data jsonb not null default '{}'::jsonb,
  ai_score jsonb null,
  created_at timestamptz not null default now(),
  constraint jobs_source_external_id_key unique (source, external_id)
);
