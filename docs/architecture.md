# Zero-Budget Architecture Blueprint

## 1. Goal

Design a zero-budget MVP for monitoring freelance jobs that:

- runs with no always-on servers
- is triggered by `GitHub Actions` on a schedule
- stores state in `Supabase PostgreSQL`
- uses cheap or free LLM APIs only after hard prefiltering
- sends selected jobs to Telegram with inline feedback buttons
- remains safe to rerun without duplicate records or duplicate notifications

This document is the single source of truth for the technical architecture.

## 2. Fixed Stack

### Compute and scheduling

- `GitHub Actions` cron
- one monolithic `TypeScript / Node.js` script per run
- no long-running worker process
- no background queue service

### State store

- `Supabase PostgreSQL` free tier
- statuses in DB act as the queue and state machine
- idempotency and run coordination are DB-backed
- `Supabase CLI` is optional; SQL can be applied manually through `Supabase Dashboard -> SQL Editor`

### AI layer

- `Groq Llama 3` or `Google Gemini Flash`
- hard prefilter before any LLM request
- LLM only for semantic relevance, summary, and recommendation

### Delivery

- `Telegram Bot API`
- Telegram inline buttons for user feedback

## 3. Architectural Decision

We explicitly choose a **single linear serverless batch pipeline**.

That means:

- one script starts
- the script executes all stages in order
- the script exits
- the next run is started later by GitHub Actions cron

We explicitly do **not** use:

- `n8n`
- `Redis`
- multiple workers
- always-on servers
- a microservice topology

Why this is the correct choice:

- zero operational cost
- low RAM usage
- simple local testing
- reliable behavior on free tiers
- fewer moving parts

## 4. Execution Model

## 4.1 Local-first development

Development starts locally on the user's machine.

The same script that later runs in GitHub Actions must be runnable locally.

Typical local flow:

- run the TypeScript script manually
- connect to the same `Supabase PostgreSQL` project
- inspect DB rows and Telegram messages

This keeps local and cloud execution identical.

## 4.2 Cloud execution

Production-like MVP execution:

- `GitHub Actions` runs every hour
- the workflow starts one Node.js script
- the script processes enabled sources
- state is persisted in Supabase
- the script exits after finishing

This is a batch architecture, not an always-on service architecture.

## 5. High-Level Linear Pipeline

The full run is intentionally linear and safe:

```text
Collect new jobs -> Save/update in DB -> Hard prefilter -> LLM score -> Publish to Telegram -> Update status in DB
```

Expanded form:

```text
1. Start run
2. Load enabled sources
3. Fetch only new jobs
4. Upsert jobs into DB
5. Normalize and deduplicate
6. Apply hard prefilters
7. Send only passing jobs to LLM
8. Decide publish / reject
9. Send selected jobs to Telegram
10. Persist notification result
11. Finish run
```

## 6. Why a Linear Pipeline Is Still Safe

Even though runtime is linear, safety is preserved through DB state.

Each stage:

- reads a known status
- performs one deterministic step
- writes the next legal status

So the script is simple, but the state transitions remain explicit.

That gives:

- safe reruns
- easy debugging
- clear auditability
- no need for extra infrastructure

## 7. Detailed Stage Logic

## 7.1 Stage 1: Start run

The script creates a `source_run` record per source or one global run record.

Purpose:

- audit the execution
- track failures
- avoid overlapping runs if needed

Minimal behavior:

- generate `run_id`
- timestamp the start
- log source count

## 7.2 Stage 2: Collect only new jobs

For each enabled source:

- fetch only new jobs
- use source checkpoint / last seen ID / last seen time when available
- do not download full history every hour

Safe-source rules:

- use jitter between source requests if needed
- keep concurrency low, usually 1
- honor cooldown after 429/403

## 7.3 Stage 3: Save or update jobs in DB

Every fetched job is upserted into `jobs`.

Goals:

- keep one canonical record per logical job
- avoid duplicates across reruns
- preserve raw data for replay and debugging

At this stage:

- raw payload is stored in `jobs.raw_data_jsonb`
- dedupe keys are computed
- status becomes `collected` or stays unchanged if already processed

## 7.4 Stage 4: Normalize and deduplicate

The script normalizes fields into the canonical shape.

Examples:

- title
- description
- budget
- currency
- source URL
- external ID
- skills
- language

The script also computes:

- `canonical_url_hash`
- `content_hash`

If the job is already known and unchanged:

- do not rescore
- do not republish
- keep the previous final state

## 7.5 Stage 5: Hard prefilter

This is mandatory and always happens before the LLM call.

Hard prefilter checks:

- minimum budget
- blocked regex
- blocked keywords
- preferred keyword overlap
- allowed language
- category restrictions
- description completeness

Possible result:

- `rejected_prefilter`
- `ready_for_llm`

The LLM must never receive jobs that already failed here.

## 7.6 Stage 6: LLM scoring

Only jobs in `ready_for_llm` are sent to the AI provider.

Recommended providers:

- `Groq Llama 3`
- `Google Gemini Flash`

LLM responsibilities:

- semantic relevance scoring
- short summary generation
- recommendation generation
- risk flag detection

Expected structured output:

- `relevance_score`
- `confidence_score`
- `summary`
- `recommendation`
- `pros`
- `cons`
- `risk_flags`

The raw AI result is stored in JSONB so the run can be audited or replayed later.

## 7.7 Stage 7: Publish decision

The script applies final publish rules after LLM scoring.

Example policy:

- publish if `relevance_score >= 75` and no critical risk flags
- hold or reject if the score is borderline
- reject if weak or risky

Possible states:

- `rejected`
- `ready_to_publish`

## 7.8 Stage 8: Telegram delivery

Only `ready_to_publish` jobs are sent to Telegram.

Each message contains:

- title
- source
- budget if available
- short summary
- recommendation
- 2-3 brief reasons
- source link

Telegram message also contains inline buttons, for example:

- `Interesting`
- `Not Relevant`
- `Applied`
- `Skip`

Those callbacks are later written back into the DB as feedback.

## 7.9 Stage 9: Status update and finish

After a successful send:

- notification metadata is saved
- job status becomes `published`

If sending fails:

- job status becomes `delivery_failed`
- error info is saved

The run then finishes and exits.

## 8. Job State Machine

Minimal `jobs.status` values:

- `collected`
- `normalized`
- `rejected_prefilter`
- `ready_for_llm`
- `scored`
- `rejected`
- `ready_to_publish`
- `published`
- `delivery_failed`
- `reviewed`
- `error`

Rules:

- each stage can only move a job to the next legal state
- once `published`, a rerun must not publish it again unless a future explicit republish policy exists
- unchanged jobs should be skipped as early as possible

## 9. Idempotency Model

## 9.1 Job identity

Primary dedupe keys:

- `source_code + external_id`
- fallback: `source_code + canonical_url_hash`
- fallback: `content_hash`

Use DB unique constraints and upserts.

## 9.2 Notification idempotency

Each notification should have a deterministic idempotency key, for example:

- `job_id + telegram + message_version`

If the script is rerun:

- it checks whether notification already exists
- if yes, it does not send again

## 9.3 Run safety

GitHub Actions may rerun a failed job manually or automatically.

So the script must assume:

- any stage may execute again
- the DB must make that safe

## 10. Database-Centric Coordination

There is no external queue.

The database plays three roles:

- canonical state store
- idempotency layer
- execution coordination layer

This is enough because:

- runs are hourly
- one batch script is small
- volume at MVP is limited

## 11. Main `jobs` Table Schema

The main table is `jobs`.

It intentionally stores both canonical fields and JSONB blobs for raw source data and AI logs.

### Proposed schema

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),

  source_code text not null,
  external_id text null,
  source_url text not null,
  canonical_url_hash text not null,
  content_hash text not null,

  title text null,
  description text null,
  short_description text null,
  budget_min numeric null,
  budget_max numeric null,
  currency text null,
  language text null,
  project_type text null,
  skills_jsonb jsonb not null default '[]'::jsonb,

  status text not null,
  recommendation text null,
  relevance_score integer null,
  confidence_score numeric null,
  summary text null,

  raw_data_jsonb jsonb not null default '{}'::jsonb,
  prefilter_log_jsonb jsonb not null default '{}'::jsonb,
  ai_log_jsonb jsonb not null default '{}'::jsonb,
  delivery_log_jsonb jsonb not null default '{}'::jsonb,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  published_at timestamptz null,
  last_error_at timestamptz null,
  last_error_message text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Recommended indexes

```sql
create unique index jobs_source_external_uidx
  on jobs (source_code, external_id)
  where external_id is not null;

create unique index jobs_source_canonical_url_uidx
  on jobs (source_code, canonical_url_hash);

create index jobs_status_idx on jobs (status);
create index jobs_first_seen_idx on jobs (first_seen_at desc);
create index jobs_published_at_idx on jobs (published_at desc);
```

## 12. Why JSONB Is Used In `jobs`

### `raw_data_jsonb`

Stores the original payload from the source.

Examples:

- raw API response fields
- raw parsed HTML fields
- source-specific metadata

Why:

- replay parsing later
- debug connector issues
- avoid losing source-specific context

### `prefilter_log_jsonb`

Stores cheap filtering results.

Examples:

- matched keywords
- reject reasons
- budget check result
- language check result

Why:

- explain why a job was rejected before AI
- debug cost optimization rules

### `ai_log_jsonb`

Stores structured AI logs.

Examples:

- provider name
- model name
- prompt version
- compact input sent to model
- raw JSON response from model
- parsed risk flags
- token or request metadata if available

Why:

- reproducibility
- auditability
- future prompt tuning

### `delivery_log_jsonb`

Stores Telegram delivery metadata.

Examples:

- message ID
- chat ID
- inline callback metadata
- delivery attempt timestamps

Why:

- delivery debugging
- idempotency checks
- feedback linking

## 13. Minimal Supporting Tables

Even though `jobs` is the main table, a few support tables are still useful.

### `source_runs`

Tracks each scheduled run.

Suggested fields:

- `id`
- `source_code`
- `status`
- `started_at`
- `finished_at`
- `fetched_count`
- `new_count`
- `error_count`
- `log_jsonb`

### `job_feedback`

Stores feedback from Telegram inline buttons.

Suggested fields:

- `id`
- `job_id`
- `telegram_user_id`
- `decision`
- `payload_jsonb`
- `created_at`

## 14. AI Cost Control Rules

Mandatory rules:

- never send full raw HTML to the model
- never send jobs that failed hard prefilter
- never send unchanged duplicates
- send only compact normalized text
- prefer a cheap/free LLM provider first
- store AI response logs to avoid unnecessary repeat analysis

## 15. Failure Handling

## 15.1 Source failure

If one source fails:

- log the failure into `source_runs`
- continue with the next source
- do not fail the whole batch unless all sources fail catastrophically

## 15.2 AI failure

If the AI provider fails:

- retry a limited number of times
- if still failing, set the job to `error` or keep `ready_for_llm`
- do not block unrelated jobs

## 15.3 Telegram failure

If Telegram send fails:

- set `delivery_failed`
- store error in `delivery_log_jsonb`
- allow safe retry on next run or manual replay

## 16. Anti-Ban and Source Safety

Per source we should store:

- polling interval
- cooldown policy
- transport type
- last successful checkpoint

Recommended source order of preference:

1. official API
2. RSS / feed / search export
3. email alerts
4. browser automation only as fallback

Rules:

- keep concurrency low
- randomize request timing slightly
- honor 429 / 403 cooldowns
- do not hammer sources on failure

## 17. Final MVP Definition

A correct MVP means:

- hourly GitHub Actions cron
- one Node.js script per run
- Supabase as the state store
- strict prefilter before AI
- free LLM provider for semantic filtering
- Telegram delivery with inline feedback
- no always-on infra
- no Redis
- no auto-apply

## 18. Immediate Build Plan

1. Create the `jobs`, `source_runs`, and `job_feedback` tables in Supabase.
2. Apply the SQL schema through `Supabase Dashboard -> SQL Editor` or use Supabase CLI later only if you explicitly need it.
3. Implement the TypeScript script `run-once.ts`.
4. Implement one source connector.
5. Implement hard prefilter logic.
6. Implement Groq or Gemini Flash scoring.
7. Implement Telegram send with inline buttons.
8. Add GitHub Actions cron.
9. Test the exact same script locally before cloud scheduling.
