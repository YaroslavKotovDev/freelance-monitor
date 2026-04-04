# 🤖 Freelance Monitor

> Personal AI-powered recruiter for freelance job listings. Monitors remote job boards, filters noise, scores opportunities with LLM, and delivers the best leads directly to Telegram.

---

## How It Works

```
RSS Feeds → Pre-filter → AI Scoring → Telegram
```

1. **Ingestion** — fetches jobs from multiple RSS sources every 30 minutes via GitHub Actions
2. **Pre-filter** — instantly rejects irrelevant listings using a stop-word rule engine (no LLM cost)
3. **AI Scoring** — sends qualified jobs to GPT for relevance scoring and Russian-language summary
4. **Delivery** — sends top-scored jobs to Telegram with inline buttons

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | TypeScript, Node.js 20+, ESModules |
| Database | Supabase PostgreSQL (free tier) |
| Scheduler | GitHub Actions cron |
| AI | OpenAI / OpenRouter |
| Delivery | Telegram Bot API |

No Redis. No heavy workers. No paid infrastructure.

---

## Pipeline Details

### Sources

| Source | Feed |
|---|---|
| WeWorkRemotely | Frontend Programming Jobs |
| RemoteOK | TypeScript Jobs |

### Job Status Flow

```
new
 ├── prefilter_rejected     (stop-word match or not from today)
 └── ready_for_llm
      ├── llm_rejected      (AI score < 85)
      ├── llm_failed        (max retries exceeded)
      └── publish_ready
           ├── published    (sent to Telegram ✅)
           └── publish_failed (Telegram error, retried)
```

### AI Output

Each job scored by LLM returns:

```json
{
  "relevanceScore": 92,
  "summary": "Разработка TypeScript API для SaaS-платформы",
  "recommendation": "Стоит взять — стек совпадает, бюджет адекватный",
  "risks": ["Нет чёткого ТЗ", "Сжатые сроки"],
  "stackFit": "Полное совпадение: Node.js, TypeScript, PostgreSQL"
}
```

Threshold: `relevanceScore >= 85` → sent to Telegram.

### Retry Policy

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
├── index.ts                  # Main orchestrator
├── types.ts                  # Shared interfaces
├── db/
│   └── supabase.ts           # DB client
├── ingestion/
│   ├── fetchJobs.ts          # Stage entry point
│   ├── parseRss.ts           # RSS fetch + XML parse + content_hash
│   └── saveJobs.ts           # Insert with dedup
├── prefilter/
│   ├── prefilterJobs.ts      # Stop-word filter + today-only logic
│   └── stopWords.ts          # Stop-word list
├── scoring/
│   ├── scoreJobs.ts          # LLM scoring with retry
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

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → create new project
2. Open **SQL Editor** and run both migration files:
   - `supabase/migrations/001_create_jobs.sql`
   - `supabase/migrations/002_upgrade_jobs.sql`

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

LLM_PROVIDER=openai              # or openrouter
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4.1-mini

TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

### 4. Run locally

```bash
npx tsx --env-file=.env src/index.ts
```

---

## GitHub Actions (Auto-run)

Add all `.env` variables as **GitHub Secrets**, then create `.github/workflows/monitor.yml`:

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
🌐 Источник: weworkremotely
📋 Суть: Разработка Node.js бэкенда для финтех-стартапа
🔧 Стек: Полное совпадение — TS, Node.js, PostgreSQL
💡 Вывод: Стоит взять — сильный стек и адекватный бюджет
⚠️ Риски: Нет ТЗ, стартап без трекшена

[ ✅ Взять ]  [ 🙈 Скрыть ]
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key |
| `LLM_PROVIDER` | ✅ | `openai` or `openrouter` |
| `LLM_API_KEY` | ✅ | API key for LLM provider |
| `LLM_MODEL` | ✅ | Model name (e.g. `gpt-4.1-mini`) |
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | Your Telegram user/chat ID |
