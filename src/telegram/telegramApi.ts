function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export interface TelegramMessage {
  jobId: string;
  title: string;
  budget: string | null;
  source: string;
  summary: string;
  recommendation: string;
  risks: string[];
  stackFit: string;
  link: string;
}

export interface TelegramSendResult {
  messageId: string;
  chatId: string;
}

export async function sendTelegramMessage(msg: TelegramMessage, chatId: string): Promise<TelegramSendResult> {
  const token = getRequiredEnv('TELEGRAM_BOT_TOKEN');

  const title = decodeHtmlEntities(msg.title);
  const risksText = msg.risks.length > 0
    ? `⚠️ *Ризики:* ${escapeMarkdownV2(msg.risks.join(', '))}`
    : null;

  const lines = [
    `*${escapeMarkdownV2(title)}*`,
    ``,
    `💰 *Бюджет:* ${escapeMarkdownV2(msg.budget ?? 'не вказано')}`,
    `🌐 *Джерело:* ${escapeMarkdownV2(msg.source)}`,
    `📋 *Суть:* ${escapeMarkdownV2(msg.summary)}`,
    `🔧 *Стек:* ${escapeMarkdownV2(msg.stackFit)}`,
    `💡 *Висновок:* ${escapeMarkdownV2(msg.recommendation)}`,
    ...(risksText ? [risksText] : []),
  ];

  const body = {
    chat_id: chatId,
    text: lines.join('\n'),
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Взяти', url: msg.link },
        { text: '🙈 Сховати', callback_data: `hide:${msg.jobId}` },
      ]],
    },
  };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram API error ${response.status}: ${err}`);
  }

  const result = await response.json() as { result: { message_id: number } };
  return {
    messageId: String(result.result.message_id),
    chatId: String(chatId),
  };
}
