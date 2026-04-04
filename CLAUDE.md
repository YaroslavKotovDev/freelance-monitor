# freelance-monitor — Project Context for Claude

## What this project is

A lightweight freelance job monitoring system. It fetches job listings from RSS feeds, filters them, scores them via LLM, and delivers relevant ones to Telegram.

## Stack

- **Runtime**: TypeScript, Node.js ≥20, ESModules (`"type": "module"`)
- **Database**: Supabase PostgreSQL (state store)
- **Scheduling**: GitHub Actions cron (not yet configured)
- **Notifications**: Telegram Bot API
- **LLM**: Configurable via env (OpenAI or OpenRouter)
- **No**: axios, Redis, n8n, heavy workers, microservices

## Project structure

```
src/
  index.ts                    # Stage 6: main() orchestrator
  types.ts                    # Shared Job interface
  db/
    supabase.ts               # Supabase client init
  ingestion/
    fetchJobs.ts              # Stage 2 entry point
    parseRss.ts               # RSS fetch + XML parse (no heavy libs)
    saveJobs.ts               # Insert with dedup (unique constraint 23505)
  prefilter/
    prefilterJobs.ts          # Stage 3: stop-word filter
    stopWords.ts              # Stop-word list constant
  scoring/
    scoreJobs.ts              # Stage 4: LLM scoring
    llm.ts                    # LLM API helper (OpenAI/OpenRouter)
  telegram/
    notifyUser.ts             # Stage 5: send to Telegram
    telegramApi.ts            # Telegram Bot API helper
supabase/
  migrations/
    001_create_jobs.sql       # jobs table DDL
```

## Job status flow

```
new → prefilter_rejected
new → ready_for_llm → llm_rejected
new → ready_for_llm → publish_ready → published
```

## Environment variables

| Variable                  | Required | Description                          |
|---------------------------|----------|--------------------------------------|
| `SUPABASE_URL`            | ✅        | Supabase project URL                 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅      | Supabase service role key            |
| `LLM_PROVIDER`            | ✅        | `openai` or `openrouter`             |
| `LLM_API_KEY`             | ✅        | API key for LLM provider             |
| `LLM_MODEL`               | ✅        | Model name (e.g. `gpt-4o-mini`)      |
| `TELEGRAM_BOT_TOKEN`      | ✅        | Bot token from @BotFather            |
| `TELEGRAM_CHAT_ID`        | ✅        | Your Telegram chat/user ID           |

## How to run locally

```bash
cp .env.example .env   # fill in all variables
npx tsx --env-file=.env src/index.ts
```

## Rules for implementing changes

- One stage at a time — don't bleed logic across stages
- No axios — use native `fetch`
- No heavy XML libs — parse manually
- Strict TypeScript — no `any`, use proper types
- One bad record must never crash the whole batch — always wrap loops in try/catch
- Don't add dependencies without clear need
- Stop-words live in `src/prefilter/stopWords.ts`
- LLM relevance threshold is `75` in `src/scoring/scoreJobs.ts`
