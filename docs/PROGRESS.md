# Implementation Progress

## Stage 1 — Setup & Database ✅

- `package.json` — ESModules, Node ≥20, `@supabase/supabase-js`, `zod`
- `tsconfig.json` — strict TypeScript, NodeNext modules
- `supabase/migrations/001_create_jobs.sql` — jobs table base schema
- `supabase/migrations/002_upgrade_jobs.sql` — extended schema: content_hash, retry fields, telegram fields, indexes, updated_at trigger
- `src/db/supabase.ts` — Supabase client with env validation
- `.env.example` — all required variables

**Verified:** DB connection tested and working.

---

## Stage 2 — Ingestion ✅

- `src/types.ts` — `JobInput` and `AiScore` interfaces
- `src/ingestion/parseRss.ts` — multi-source RSS fetch with `Promise.allSettled`, manual XML parse, `content_hash` via SHA-256, `pubDate` parsing, per-source timeout, HTML entity decoding
- `src/ingestion/saveJobs.ts` — insert with `23505` dedup (one by one)
- `src/ingestion/fetchJobs.ts` — orchestrates fetch + save

**Sources:** WeWorkRemotely (frontend), RemoteOK (typescript)

**Dedup:** `UNIQUE(source, external_id)` + `content_hash` (secondary)

---

## Stage 3 — Pre-filtering ✅

- `src/prefilter/stopWords.ts` — `STOP_WORDS` constant
- `src/prefilter/prefilterJobs.ts` — batch of 50, today-only filter via `source_published_at`, stop-word match on title+description

**Today filter:** jobs with `source_published_at` before today are auto-rejected

**Statuses:** `new` → `prefilter_rejected` | `ready_for_llm`

---

## Stage 4 — AI Scoring ✅

- `src/scoring/llm.ts` — `callLlm()` with Zod schema validation, Russian-language output, extended response: `relevanceScore`, `summary`, `recommendation`, `risks[]`, `stackFit`
- `src/scoring/scoreJobs.ts` — batch of 10, atomic `llm_processing` claim, retry with exponential backoff (15min → 1h → 6h), max 4 attempts → `llm_failed`

**Threshold:** `relevanceScore >= 85` → `publish_ready`

**Retry backoff:** attempt 1→15min, 2→1h, 3→6h, 4→terminal `llm_failed`

---

## Stage 5 — Telegram Delivery ✅

- `src/telegram/telegramApi.ts` — MarkdownV2 with escaping + HTML entity decode, returns `messageId`, "Взять" is URL button (opens job link directly)
- `src/telegram/notifyUser.ts` — max 5 per run, atomic `publishing` claim, saves `telegram_message_id` + `telegram_chat_id`, on failure → `publish_failed` + retry in 15min

**Message:** title, budget, source, summary, stackFit, recommendation, risks

---

## Stage 6 — Orchestration ✅

- `src/index.ts` — `main()` sequential pipeline, `process.exit(0/1)`

**Pipeline:** `fetchJobs()` → `prefilterJobs()` → `scoreJobs()` → `notifyUser()`

---

## Pending

- [ ] Apply `002_upgrade_jobs.sql` migration in Supabase Dashboard → SQL Editor
- [ ] Set up GitHub Actions cron workflow (every 30min)
- [ ] Telegram webhook handler for "Скрыть" button (`hidden_by_user` status)
- [ ] `publish_failed` retry handling in next pipeline runs
