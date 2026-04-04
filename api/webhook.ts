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

    await supabase
      .from('app_settings')
      .update({ telegram_chat_id: chatId })
      .eq('id', 1);

    await sendMessage(
      token,
      chatId,
      '✅ Підключено! Тепер ти будеш отримувати сповіщення про нові вакансії.',
    );

    res.status(200).json({ ok: true });
    return;
  }

  // ─── Inline button callback ──────────────────────────────────────────────────
  const cb = update.callback_query;

  if (!cb?.data || !cb.message) {
    res.status(200).json({ ok: true });
    return;
  }

  // callback_data format: "hide:<jobId>"
  const [action, jobId] = cb.data.split(':');

  if (action !== 'hide' || !jobId) {
    await answerCallbackQuery(token, cb.id, '');
    res.status(200).json({ ok: true });
    return;
  }

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

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook] Error:', err);
    await answerCallbackQuery(token, cb.id, 'Помилка, спробуй ще раз');
    res.status(200).json({ ok: false });
  }
}
