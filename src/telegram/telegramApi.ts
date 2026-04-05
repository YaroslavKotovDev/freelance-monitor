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

function scoreEmoji(score: number): string {
  if (score >= 85) return '🔥';
  if (score >= 70) return '🟡';
  return '🔴';
}

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

const SOURCE_LABELS: Record<string, string> = {
  'freelancer-react':      'Freelancer · React',
  'freelancer-typescript': 'Freelancer · TS',
  'freelancer-vue':        'Freelancer · Vue',
  'freelancer-nextjs':     'Freelancer · Next.js',
  'freelancer-nodejs':     'Freelancer · Node.js',
  'pph-js':                'PeoplePerHour · JS',
  'pph-react':             'PeoplePerHour · React',
  'guru-react':            'Guru · React',
  'guru-nodejs':           'Guru · Node.js',
  'upwork-react':          'Upwork · React',
  'upwork-typescript':     'Upwork · TS',
  'upwork-vue':            'Upwork · Vue',
  'upwork-nodejs':         'Upwork · Node.js',
  'reddit-forhire':        'Reddit · r/forhire',
  'reddit-slavelabour':    'Reddit · r/slavelabour',
  'hn-hiring':             'HN · Who is Hiring',
};

export interface TelegramMessage {
  jobId: string;
  title: string;
  budget: string | null;
  source: string;
  score: number;
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
  const sourceLabel = SOURCE_LABELS[msg.source] ?? msg.source;
  const emoji = scoreEmoji(msg.score);
  const bar = scoreBar(msg.score);
  const budget = msg.budget ?? 'не вказано';
  const risksText = msg.risks.length > 0
    ? `\n⚠️ *Ризики:* ${escapeMarkdownV2(msg.risks.join('; '))}`
    : '';

  const lines = [
    `${emoji} *${escapeMarkdownV2(title)}*`,
    ``,
    `${escapeMarkdownV2(bar)} *${msg.score}/100*  ·  ${escapeMarkdownV2(sourceLabel)}`,
    `💰 ${escapeMarkdownV2(budget)}`,
    ``,
    `📋 ${escapeMarkdownV2(msg.summary)}`,
    `💡 ${escapeMarkdownV2(msg.recommendation)}`,
    `🔧 ${escapeMarkdownV2(msg.stackFit)}`,
    ...(risksText ? [risksText] : []),
  ];

  const body = {
    chat_id: chatId,
    text: lines.join('\n'),
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Взяти', url: msg.link },
          { text: '🙈 Сховати', callback_data: `hide:${msg.jobId}` },
        ],
        [
          { text: '✍️ Відгук', callback_data: `cover:${msg.jobId}` },
          { text: '👍 Цікаво', callback_data: `taken:${msg.jobId}` },
        ],
      ],
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
