# Stage Implementation Prompts

Этот файл содержит готовые промпты для реализации каждого этапа проекта.

Правило использования:

- запускать только один stage prompt за раз
- не переходить к следующему этапу, пока текущий не завершен и не протестирован
- не писать код для будущих этапов заранее
- сохранять строгую идемпотентность и минимализм архитектуры

---

## Stage 1 Prompt: Setup & Database

```text
Роль: Ты Senior Serverless/TypeScript Engineer.

Контекст:
Мы строим легковесную систему мониторинга фриланс-заказов.
Архитектура уже утверждена:
- TypeScript, Node.js, ESModules
- GitHub Actions как cron
- Supabase PostgreSQL как state store
- Telegram Bot API для доставки
- LLM будет подключаться позже
- никаких n8n, Redis, тяжелых воркеров и микросервисов

Текущая задача: Выполнить только Stage 1.

Что нужно сделать:
1. Создать базовую структуру проекта.
2. Создать `package.json` и `tsconfig.json`.
3. Написать SQL-миграцию для таблицы `jobs` в Supabase.
4. Создать `src/db/supabase.ts` для инициализации клиента Supabase.
5. Подготовить `.env.example` только с нужными переменными.
6. Не требовать `Supabase CLI`; миграция должна быть выполнима через `Supabase Dashboard -> SQL Editor`.

Требования к таблице `jobs`:
- `id` uuid
- `source` text
- `external_id` text
- `title` text
- `description` text
- `budget` text
- `status` text default 'new'
- `raw_data` jsonb
- `ai_score` jsonb
- `created_at`
- уникальный constraint на `(source, external_id)`

Правила:
- строгий TypeScript
- не писать код Stage 2+
- не добавлять лишние зависимости
- никакого axios
- использовать `@supabase/supabase-js`

Ожидаемый результат:
- список созданных файлов
- инструкция как применить SQL через `Supabase Dashboard -> SQL Editor`
- содержимое `package.json`
- содержимое `tsconfig.json`
- содержимое SQL-миграции
- содержимое `src/db/supabase.ts`
- краткий чек-лист как протестировать Stage 1

Стоп-условие:
После завершения Stage 1 остановись. Не переходи к Stage 2.
```

---

## Stage 2 Prompt: Ingestion

```text
Роль: Ты Senior Serverless/TypeScript Engineer.

Контекст:
Stage 1 уже завершен и протестирован.
Нужно реализовать только Stage 2.

Архитектура:
- один TypeScript-скрипт
- Supabase как state store
- запуск по cron позже через GitHub Actions
- текущая цель: ingestion одного RSS-источника

Задача:
1. Выбрать один RSS-источник.
2. Реализовать `fetchJobs()`.
3. Получить RSS/XML через `fetch`.
4. Распарсить XML.
5. Привести данные к типизированному интерфейсу `Job`.
6. Сохранить в Supabase только новые заказы со статусом `new`.

Требования:
- без axios
- без тяжелых XML-библиотек, если можно обойтись легким решением
- строгая типизация
- upsert / dedupe должен быть безопасным
- если заказ уже есть, не дублировать запись
- один плохой элемент RSS не должен ронять весь ingestion

Ожидаемые артефакты:
- интерфейс `Job`
- функция `fetchJobs()`
- функция парсинга RSS
- функция сохранения новых заказов в БД
- пример локального запуска и проверки

Важно:
- статус новых заказов должен быть `new`
- не реализовывать prefilter, AI scoring, Telegram и orchestration

Стоп-условие:
Остановись после Stage 2. Не переходи к Stage 3.
```

---

## Stage 3 Prompt: Pre-filtering

```text
Роль: Ты Senior Serverless/TypeScript Engineer.

Контекст:
Stage 1 и Stage 2 уже готовы и протестированы.
Сейчас нужно реализовать только Stage 3: жесткий prefilter.

Задача:
1. Написать `prefilterJobs()`.
2. Забрать из Supabase заказы со статусом `new`.
3. Применить жесткий фильтр по стоп-словам.
4. Обновить статусы:
   - `ready_for_llm` для прошедших
   - `prefilter_rejected` для отклоненных

Примеры стоп-слов:
- казино
- wordpress
- реферат

Требования:
- стоп-слова должны быть вынесены в конфиг или константу
- сравнение должно быть регистронезависимым
- фильтр должен работать по title + description
- один проблемный заказ не должен ронять весь batch
- только Stage 3, без Stage 4+

Что вернуть:
- код `prefilterJobs()`
- место хранения stop words
- SQL/select/update логику через Supabase
- краткий сценарий локального теста

Стоп-условие:
После реализации Stage 3 остановись.
```

---

## Stage 4 Prompt: AI Scoring

```text
Роль: Ты Senior Serverless/TypeScript Engineer.

Контекст:
Stage 1-3 уже реализованы и протестированы.
Нужно реализовать только Stage 4: AI scoring.

Задача:
1. Написать `scoreJobs()`.
2. Забрать из БД заказы со статусом `ready_for_llm`.
3. Отправить их в LLM API.
4. Попросить модель вернуть строгий JSON:
   - `relevanceScore`
   - `summary`
   - `recommendation`
5. Если `relevanceScore > 75`, обновить статус на `publish_ready`.
6. Иначе обновить статус на `llm_rejected`.
7. Записать JSON-ответ модели в колонку `ai_score`.

Требования:
- использовать `fetch`
- без SDK, если обычный HTTP достаточно прост
- сделать отдельную функцию вызова LLM
- сделать защиту от невалидного JSON
- один failed LLM call не должен ронять весь batch
- не реализовывать Telegram и orchestration

Важно:
- передавать в LLM только компактный текст заказа
- не отправлять raw HTML
- не трогать заказы не в статусе `ready_for_llm`

Что вернуть:
- функцию `scoreJobs()`
- helper для LLM API
- prompt template
- парсинг и валидацию ответа
- обновление статусов в БД
- краткий сценарий теста

Стоп-условие:
После Stage 4 остановись.
```

---

## Stage 5 Prompt: Telegram Delivery

```text
Роль: Ты Senior Serverless/TypeScript Engineer.

Контекст:
Stage 1-4 уже завершены и протестированы.
Нужно реализовать только Stage 5: Telegram delivery.

Задача:
1. Написать `notifyUser()`.
2. Забрать из БД заказы со статусом `publish_ready`.
3. Отправить красиво отформатированное сообщение в Telegram.
4. Добавить inline-кнопки:
   - "Взять"
   - "Скрыть"
5. После успешной отправки поставить статус `published`.

Требования:
- использовать Telegram Bot API через `fetch`
- форматировать сообщение аккуратно и коротко
- использовать Markdown или MarkdownV2, но безопасно экранировать текст
- одна ошибка отправки не должна ронять весь batch
- не реализовывать orchestration и не писать webhook-обработчик следующего этапа, если он явно не нужен сейчас

Что должно быть в сообщении:
- title
- budget
- summary
- recommendation
- ссылка на заказ

Что вернуть:
- функцию `notifyUser()`
- helper для Telegram API
- formatter для сообщения
- inline keyboard payload
- логику обновления статуса на `published`
- сценарий локального теста

Стоп-условие:
После Stage 5 остановись.
```

---

## Stage 6 Prompt: Orchestration & Execution

```text
Роль: Ты Senior Serverless/TypeScript Engineer.

Контекст:
Stage 1-5 уже реализованы и протестированы.
Теперь нужно реализовать только Stage 6: orchestration.

Задача:
1. Создать `src/index.ts`.
2. Собрать последовательный пайплайн:
   `await fetchJobs()` -> `await prefilterJobs()` -> `await scoreJobs()` -> `await notifyUser()`.
3. Добавить верхнеуровневый `main()` с try/catch.
4. Корректно завершать процесс:
   - `process.exit(0)` при успехе
   - `process.exit(1)` при критической ошибке

Требования:
- последовательный запуск
- строгая типизация
- понятные логи по стадиям
- если внутри одной стадии одна запись ломается, стадия сама должна уметь продолжить обработку остальных
- orchestration не должен дублировать бизнес-логику стадий

Что вернуть:
- `src/index.ts`
- верхнеуровневый `main()`
- минимальный logging flow
- пример команды локального запуска
- пример GitHub Actions команды, которая будет запускать этот entrypoint позже

Стоп-условие:
После Stage 6 остановись. Не предлагай Stage 7 или лишний рефакторинг.
```

---

## Optional Meta Prompt: Continue Only Current Stage

```text
Работай только в рамках текущего stage.
Не реализуй код следующих этапов.
Не подготавливай задел на следующие этапы, если это не критично для текущего.
Сначала выдай список файлов, которые изменишь.
После этого покажи код и краткий способ локальной проверки.
```
