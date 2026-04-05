import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
}

interface CallbackQuery {
  id: string;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
}

interface AppSettings {
  is_bot_active: boolean;
  llm_provider: string | null;
  llm_api_key: string | null;
  llm_model: string | null;
  developer_profile: string | null;
}

// ─── Telegram helpers ─────────────────────────────────────────────────────────

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
}

async function editMessageReplyMarkup(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text, callback_data: 'done' }]] },
    }),
  });
}

// ─── Cover letter generation ──────────────────────────────────────────────────

async function generateCoverLetter(
  settings: AppSettings,
  job: { title: string; description: string; budget_text: string | null },
): Promise<string> {
  const { llm_provider: provider, llm_api_key: apiKey, llm_model: model, developer_profile: profile } = settings;

  if (!provider || !apiKey || !model) {
    throw new Error('LLM not configured in admin panel');
  }

  const url = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const profileSection = profile
    ? `Developer profile:\n${profile}`
    : 'Developer profile: Senior Full-Stack Developer, 4+ years experience, TypeScript/React/Node.js stack.';

  const prompt = `You are a conversion-focused copywriter writing a freelance bid on behalf of an experienced freelancer.
Your goal: make the CLIENT feel this is exactly the person they were looking for.

${profileSection}

Job posting:
Title: ${job.title}
Budget: ${job.budget_text ?? 'not specified'}
Description: ${job.description.slice(0, 1500)}

Instructions:
1. First sentence: mirror the client's core problem back to them in your own words — show you actually read and understood it
2. Second paragraph: pick the 1-2 most relevant experiences from the developer profile that directly solve THIS job. Be specific — mention tech, numbers, outcomes.
3. Optional: one short sentence that preemptively kills the biggest objection (timeline, stack fit, or availability)
4. Final sentence: a low-friction CTA — ask one smart clarifying question about the project OR offer to show a relevant example. Never say "let's hop on a call" generically.

Tone & style rules:
- Write as a confident, busy freelancer who picks projects carefully — not someone desperate for work
- Sound like a human, not a corporate email
- No opener like "I am writing to apply", "I am a passionate developer", "I would love to", "I am excited"
- No self-praise without proof ("I am the best" → forbidden; "reduced response time by 97%" → perfect)
- Keep it tight: 3 short paragraphs, maximum 130 words total
- Match the language of the job description exactly (English job → English reply, Ukrainian → Ukrainian, Russian → Russian)
- Output ONLY the cover letter text — no subject line, no greeting, no label, no explanation`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = json.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty LLM response');

  return content;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const token = getEnv('TELEGRAM_BOT_TOKEN');
  const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const update = req.body as TelegramUpdate;

  // ─── /start command — register chat_id ──────────────────────────────────────
  if (update.message?.text?.startsWith('/start')) {
    const chatId = update.message.chat.id;

    const { data: settings } = await supabase
      .from('app_settings')
      .update({ telegram_chat_id: chatId })
      .eq('id', 1)
      .select('is_bot_active')
      .single();

    const isActive = (settings as { is_bot_active: boolean } | null)?.is_bot_active ?? false;

    const text = isActive
      ? '✅ Підключено! Вакансії почнуть надходити автоматично кожні 30 хвилин.'
      : '✅ Telegram підключено!\n\n⚠️ Бот ще не активний. Зайди в адмін-панель і увімкни його:\nhttps://freelance-monitor-xi.vercel.app/admin/';

    await sendMessage(token, chatId, text);
    res.status(200).json({ ok: true });
    return;
  }

  // ─── Inline button callbacks ──────────────────────────────────────────────────
  const cb = update.callback_query;
  if (!cb?.data || !cb.message) {
    res.status(200).json({ ok: true });
    return;
  }

  const colonIdx = cb.data.indexOf(':');
  const action = colonIdx !== -1 ? cb.data.slice(0, colonIdx) : cb.data;
  const jobId = colonIdx !== -1 ? cb.data.slice(colonIdx + 1) : '';

  // ─── Hide ────────────────────────────────────────────────────────────────────
  if (action === 'hide' && jobId) {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'hidden_by_user' })
        .eq('id', jobId)
        .in('status', ['published', 'publish_ready']);

      if (error) throw error;

      await Promise.all([
        answerCallbackQuery(token, cb.id, '🙈 Сховано'),
        editMessageReplyMarkup(token, cb.message.chat.id, cb.message.message_id, '🙈 Сховано'),
      ]);
    } catch (err) {
      console.error('[webhook] hide error:', err);
      await answerCallbackQuery(token, cb.id, 'Помилка, спробуй ще раз');
    }

    res.status(200).json({ ok: true });
    return;
  }

  // ─── Cover letter ─────────────────────────────────────────────────────────────
  if (action === 'cover' && jobId) {
    // Answer immediately so Telegram doesn't show spinner
    await answerCallbackQuery(token, cb.id, '✍️ Генерую відгук...');

    try {
      const [jobResult, settingsResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('title, description, budget_text')
          .eq('id', jobId)
          .single(),
        supabase
          .from('app_settings')
          .select('llm_provider, llm_api_key, llm_model, developer_profile')
          .eq('id', 1)
          .single(),
      ]);

      if (jobResult.error) throw jobResult.error;
      if (settingsResult.error) throw settingsResult.error;

      const job = jobResult.data as { title: string; description: string; budget_text: string | null };
      const settings = settingsResult.data as AppSettings;

      const coverLetter = await generateCoverLetter(settings, job);

      await sendMessage(
        token,
        cb.message.chat.id,
        `✍️ *Відгук на:* ${job.title}\n\n${coverLetter}`,
      );
    } catch (err) {
      console.error('[webhook] cover letter error:', err);
      await sendMessage(
        token,
        cb.message.chat.id,
        '❌ Не вдалося згенерувати відгук. Перевір налаштування LLM в адмін-панелі.',
      );
    }

    res.status(200).json({ ok: true });
    return;
  }

  // Unknown action
  await answerCallbackQuery(token, cb.id, '');
  res.status(200).json({ ok: true });
}
