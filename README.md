# Freelance Monitor

AI-powered pipeline that monitors remote job boards, filters noise, scores listings with LLM, and delivers top opportunities to Telegram.

---

## How It Works

```
RSS Feeds → Pre-filter → AI Scoring → Telegram
```

1. **Ingestion** — fetches jobs from multiple RSS sources on a cron schedule
2. **Pre-filter** — instantly rejects irrelevant listings via stop-word rules (no LLM cost)
3. **AI Scoring** — sends qualified jobs to GPT, returns relevance score + Ukrainian-language summary
4. **Delivery** — pushes top-scored jobs to Telegram with inline action buttons

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | TypeScript, Node.js 20+, ESModules |
| Database | Supabase PostgreSQL |
| Scheduler | GitHub Actions cron |
| AI | OpenAI / OpenRouter |
| Notifications | Telegram Bot API |

Zero paid infrastructure. No Redis. No heavy workers.

---

## Job Status Flow

```
new
 ├── prefilter_rejected     (stop-word match or older than today)
 └── ready_for_llm
      ├── llm_rejected      (score < 85)
      ├── llm_failed        (max retries exceeded)
      └── publish_ready
           ├── published    (sent to Telegram ✅)
           └── publish_failed
```

---

## AI Output

Each job scored by LLM returns structured JSON validated with Zod:

```json
{
  "relevanceScore": 92,
  "summary": "Розробка TypeScript API для SaaS-платформи",
  "recommendation": "Варто взяти — стек збігається, бюджет адекватний",
  "risks": ["Немає чіткого ТЗ", "Стислі терміни"],
  "stackFit": "Повний збіг: Node.js, TypeScript, PostgreSQL"
}
```

Threshold: `relevanceScore >= 85` → delivered to Telegram.

---

## Retry Policy

| Attempt | Delay |
|---|---|
| 1st failure | 15 minutes |
| 2nd failure | 1 hour |
| 3rd failure | 6 hours |
| 4th failure | `llm_failed` (terminal) |

---

## Project Structure

```
src/
├── index.ts                  # Pipeline orchestrator
├── types.ts                  # Shared interfaces
├── db/
│   └── supabase.ts           # DB client
├── ingestion/
│   ├── fetchJobs.ts          # Stage entry point
│   ├── parseRss.ts           # Multi-source RSS fetch + content_hash
│   └── saveJobs.ts           # Insert with dedup
├── prefilter/
│   ├── prefilterJobs.ts      # Stop-word filter + today-only logic
│   └── stopWords.ts          # Stop-word list
├── scoring/
│   ├── scoreJobs.ts          # LLM scoring with retry/backoff
│   └── llm.ts                # LLM API helper + Zod validation
└── telegram/
    ├── notifyUser.ts         # Delivery with idempotency
    └── telegramApi.ts        # Telegram Bot API helper
supabase/
└── migrations/
    ├── 001_create_jobs.sql   # Base schema
    └── 002_upgrade_jobs.sql  # Extended schema (retry, content_hash, indexes)
```

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YaroslavKotovDev/freelance-monitor.git
cd freelance-monitor
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run both migration files in order:
   - `supabase/migrations/001_create_jobs.sql`
   - `supabase/migrations/002_upgrade_jobs.sql`

### 3. Environment

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `LLM_PROVIDER` | ✅ | `openai` or `openrouter` |
| `LLM_API_KEY` | ✅ | API key for LLM provider |
| `LLM_MODEL` | ✅ | Model name (e.g. `gpt-4.1-mini`) |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | Your Telegram user/chat ID |

### 4. Run locally

```bash
npx tsx --env-file=.env src/index.ts
```

---

## GitHub Actions

Add all `.env` values as **GitHub Secrets**, then create `.github/workflows/monitor.yml`:

```yaml
name: Freelance Monitor

on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

concurrency:
  group: freelance-monitor
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx tsx src/index.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          LLM_PROVIDER: ${{ secrets.LLM_PROVIDER }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
          LLM_MODEL: ${{ secrets.LLM_MODEL }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
```

---

## Telegram Message Format

```
*Senior TypeScript Engineer — Remote*

💰 Бюджет: $3000
🌐 Джерело: weworkremotely
📋 Суть: Розробка Node.js бекенду для фінтех-стартапу
🔧 Стек: Повний збіг — TS, Node.js, PostgreSQL
💡 Висновок: Варто взяти — сильний стек та адекватний бюджет
⚠️ Ризики: Немає ТЗ, стартап без трекшену

[ ✅ Взяти ]  [ 🙈 Сховати ]
```
