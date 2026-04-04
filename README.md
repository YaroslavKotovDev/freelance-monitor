# Freelance Monitor

AI-моніторинг фріланс-вакансій. Парсить RSS-стрічки, фільтрує стоп-словами, скорить через LLM і надсилає релевантні гіги у Telegram. Керується через веб-адмінку без змін у коді.

---

## Як це працює

```
RSS Feeds → Pre-filter → AI Scoring → Telegram
                ↑
        Налаштування з БД
        (стоп-слова, поріг, джерела)
```

1. **Settings** — пайплайн зчитує налаштування з Supabase. Якщо бот вимкнений — завершується одразу.
2. **Ingestion** — парсить активні RSS-джерела (Freelancer.com, Reddit r/forhire)
3. **Pre-filter** — відхиляє нерелевантні вакансії стоп-словами (без LLM-витрат)
4. **AI Scoring** — скорить через GPT, повертає структурований JSON українською
5. **Delivery** — надсилає у Telegram з кнопками "Взяти" / "Сховати"

---

## Live

| | URL |
|---|---|
| Статус-сторінка | `https://freelance-monitor-xi.vercel.app` |
| Адмін-панель | `https://freelance-monitor-xi.vercel.app/admin/` |
| Webhook | `https://freelance-monitor-xi.vercel.app/api/webhook` |

---

## Стек

| Шар | Технологія |
|---|---|
| Runtime | TypeScript, Node.js 20+, ESModules |
| Database | Supabase PostgreSQL |
| Scheduler | GitHub Actions cron (кожні 30 хв) |
| AI | OpenAI / OpenRouter |
| Notifications | Telegram Bot API |
| Admin UI | React + Vite + Supabase Auth |
| Hosting | Vercel (webhook + адмінка) |

Нуль платної інфраструктури. Без Redis. Без важких воркерів.

---

## Структура проєкту

```
src/
├── index.ts                  # Оркестратор пайплайну
├── types.ts                  # Спільні інтерфейси
├── db/
│   ├── supabase.ts           # DB-клієнт
│   └── settings.ts           # Завантаження налаштувань з БД (кеш на прогін)
├── ingestion/
│   ├── fetchJobs.ts          # Точка входу Stage 2
│   ├── parseRss.ts           # RSS 2.0 + Atom парсер (без XML-бібліотек)
│   └── saveJobs.ts           # Вставка з дедупліцею по content_hash
├── prefilter/
│   ├── prefilterJobs.ts      # Стоп-слова + фільтр по даті
│   └── stopWords.ts          # Константа стоп-слів (fallback якщо БД недоступна)
├── scoring/
│   ├── scoreJobs.ts          # LLM-скоринг з retry/backoff
│   └── llm.ts                # OpenAI/OpenRouter хелпер + Zod-валідація
└── telegram/
    ├── notifyUser.ts         # Доставка з ідемпотентністю
    └── telegramApi.ts        # Telegram Bot API хелпер

api/
└── webhook.ts                # Vercel serverless: /start + кнопка Сховати

admin/                        # Веб-адмінка (React + Vite)
├── src/
│   ├── App.tsx               # Auth guard
│   ├── supabase.ts           # Supabase anon client
│   └── components/
│       ├── Login.tsx         # Форма входу (Supabase Auth UI)
│       └── SettingsPanel.tsx # Керування налаштуваннями

supabase/migrations/
├── 001_create_jobs.sql       # Базова схема jobs
├── 002_upgrade_jobs.sql      # Розширена схема (retry, content_hash, indexes)
├── 003_create_settings.sql   # Таблиця app_settings + RLS
└── 004_add_telegram_chat_id.sql  # chat_id через /start
```

---

## Статус пайплайну

```
new
 ├── prefilter_rejected     (стоп-слово або стара вакансія)
 └── ready_for_llm
      ├── llm_rejected      (score < min_score з БД)
      ├── llm_failed        (вичерпано спроби)
      └── publish_ready
           ├── published        (надіслано в Telegram ✅)
           ├── publish_failed
           └── hidden_by_user   (юзер натиснув Сховати)
```

---

## Налаштування (app_settings)

Керуються через адмін-панель — без змін у коді.

| Поле | Тип | Опис |
|---|---|---|
| `is_bot_active` | boolean | Головний рубильник. `false` → пайплайн завершується одразу |
| `stop_words` | string[] | Вакансії з цими словами відхиляються на pre-filter |
| `min_score` | int | Мінімальний бал AI (0–100). За замовчуванням `75` |
| `active_sources` | string[] | Які RSS-джерела парсити |
| `telegram_chat_id` | bigint | Встановлюється автоматично через `/start` |

---

## AI Output

Кожна вакансія повертає структурований JSON (валідується Zod):

```json
{
  "relevanceScore": 92,
  "summary": "Розробка TypeScript API для SaaS-платформи",
  "recommendation": "Варто взяти — стек збігається, бюджет адекватний",
  "risks": ["Немає чіткого ТЗ", "Стислі терміни"],
  "stackFit": "Повний збіг: Node.js, TypeScript, PostgreSQL"
}
```

---

## Retry Policy

| Спроба | Затримка |
|---|---|
| 1-а помилка | 15 хвилин |
| 2-а помилка | 1 година |
| 3-я помилка | 6 годин |
| 4-а помилка | `llm_failed` (термінально) |

---

## Telegram-повідомлення

```
*Senior TypeScript Engineer — Remote*

💰 Бюджет: $3000
🌐 Джерело: freelancer-react
📋 Суть: Розробка Node.js бекенду для фінтех-стартапу
🔧 Стек: Повний збіг — TS, Node.js, PostgreSQL
💡 Висновок: Варто взяти — сильний стек та адекватний бюджет
⚠️ Ризики: Немає ТЗ, стартап без трекшену

[ ✅ Взяти ]  [ 🙈 Сховати ]
```

---

## Setup з нуля

### 1. Клон та встановлення

```bash
git clone https://github.com/YaroslavKotovDev/freelance-monitor.git
cd freelance-monitor
npm install
```

### 2. Supabase

1. Створи проєкт на [supabase.com](https://supabase.com)
2. Відкрий **SQL Editor** → виконай міграції по порядку:
   ```
   001_create_jobs.sql
   002_upgrade_jobs.sql
   003_create_settings.sql
   004_add_telegram_chat_id.sql
   ```
3. В `003_create_settings.sql` вже є дефолтний рядок. Після застосування зайди в адмінку і встанови `is_bot_active = true`.

### 3. Змінні середовища

```bash
cp .env.example .env
```

| Змінна | Де взяти |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `LLM_PROVIDER` | `openai` або `openrouter` |
| `LLM_API_KEY` | Ключ від LLM-провайдера |
| `LLM_MODEL` | Наприклад `gpt-4.1-mini` |
| `TELEGRAM_BOT_TOKEN` | @BotFather |

> `TELEGRAM_CHAT_ID` більше не потрібен — встановлюється автоматично через `/start`.

### 4. Локальний запуск

```bash
npx tsx --env-file=.env src/index.ts
```

Тест без повного LLM-прогону (ліміт 3 вакансії):

```bash
TEST_LIMIT=3 npx tsx --env-file=.env src/index.ts
```

---

## Vercel (webhook + адмінка)

### Env vars у Vercel Dashboard

| Змінна | Для чого |
|---|---|
| `SUPABASE_URL` | Webhook (кнопка Сховати, /start) |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook |
| `TELEGRAM_BOT_TOKEN` | Webhook |
| `VITE_SUPABASE_URL` | Білд адмінки (те саме значення що SUPABASE_URL) |
| `VITE_SUPABASE_ANON_KEY` | Білд адмінки (anon public, не service_role!) |

### Deploy

```bash
npx vercel deploy --prod --yes
```

### Реєстрація Telegram webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://freelance-monitor-xi.vercel.app/api/webhook"
```

---

## GitHub Actions (cron)

Додай у **GitHub Secrets** репозиторію:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LLM_PROVIDER
LLM_API_KEY
LLM_MODEL
TELEGRAM_BOT_TOKEN
```

Cron вже налаштований у `.github/workflows/monitor.yml` — запускається кожні 30 хвилин.

---

## Підключення Telegram

1. Знайди свого бота в Telegram
2. Напиши `/start`
3. Бот відповість `✅ Підключено!` і збереже `chat_id` в БД
4. В адмін-панелі `/admin/` з'явиться статус підключення

---

## Адмін-панель

`https://freelance-monitor-xi.vercel.app/admin/`

Захищена Supabase Auth. Створи користувача: Supabase Dashboard → Authentication → Users → Add user.

Що можна налаштувати без змін у коді:
- Увімкнути / вимкнути бота
- Обрати активні джерела
- Змінити поріг AI-скорингу
- Редагувати список стоп-слів
