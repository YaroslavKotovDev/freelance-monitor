import { supabase } from '../db/supabase.js';
import { getSettings } from '../db/settings.js';

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export async function sendDigest(): Promise<void> {
  const settings = getSettings();
  const chatId = settings.telegram_chat_id;
  const token = process.env['TELEGRAM_BOT_TOKEN'];

  if (!chatId || !token) {
    console.log('[digest] telegram_chat_id or TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch stats for last 24h
  const { data: allJobs } = await supabase
    .from('jobs')
    .select('status, ai_score, title, canonical_url')
    .gte('created_at', since);

  if (!allJobs || allJobs.length === 0) {
    console.log('[digest] No jobs in last 24h — skipping digest');
    return;
  }

  const total = allJobs.length;
  const published = allJobs.filter((j) => j.status === 'published').length;
  const rejected = allJobs.filter((j) => j.status === 'llm_rejected' || j.status === 'prefilter_rejected').length;
  const pending = allJobs.filter((j) => j.status === 'ready_for_llm' || j.status === 'new').length;

  // Top-3 published jobs by score
  const topJobs = allJobs
    .filter((j) => j.status === 'published' && j.ai_score)
    .sort((a, b) => {
      const sa = (a.ai_score as { relevanceScore: number }).relevanceScore;
      const sb = (b.ai_score as { relevanceScore: number }).relevanceScore;
      return sb - sa;
    })
    .slice(0, 3);

  const topLines = topJobs.map((j) => {
    const score = (j.ai_score as { relevanceScore: number }).relevanceScore;
    const title = (j.title as string).slice(0, 60);
    const url = j.canonical_url as string;
    return `  • [${escapeMarkdownV2(title)}](${escapeMarkdownV2(url)}) — *${score}*`;
  });

  const lines = [
    `📊 *Підсумок за 24 години*`,
    ``,
    `🔍 Знайдено: *${escapeMarkdownV2(String(total))}*`,
    `✅ Надіслано: *${escapeMarkdownV2(String(published))}*`,
    `❌ Відхилено: *${escapeMarkdownV2(String(rejected))}*`,
    ...(pending > 0 ? [`⏳ В черзі: *${escapeMarkdownV2(String(pending))}*`] : []),
    ...(topLines.length > 0 ? [``, `🏆 *Топ вакансій:*`, ...topLines] : []),
  ];

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  });

  console.log(`[digest] Sent digest: total=${total}, published=${published}`);
}
