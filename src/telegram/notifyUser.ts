import { supabase } from '../db/supabase.js';
import { getSettings } from '../db/settings.js';
import { sendTelegramMessage } from './telegramApi.js';
import type { AiScore } from '../types.js';

const MAX_PER_RUN = 5;

export async function notifyUser(): Promise<{ sent: number; failed: number }> {
  const chatId = getSettings().telegram_chat_id;
  if (!chatId) {
    console.warn('[telegram] telegram_chat_id not set — send /start to the bot to connect');
    return { sent: 0, failed: 0 };
  }
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, budget_text, external_id, source, ai_score')
    .eq('status', 'publish_ready')
    .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(MAX_PER_RUN);

  if (error) throw new Error(`Failed to fetch publish_ready jobs: ${error.message}`);

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    // Mark as publishing atomically
    await supabase
      .from('jobs')
      .update({ status: 'publishing', locked_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'publish_ready');

    try {
      const aiScore = job.ai_score as AiScore | null;

      const result = await sendTelegramMessage({
        jobId: job.id as string,
        title: job.title as string,
        budget: (job.budget_text as string | null) ?? null,
        source: job.source as string,
        score: aiScore?.relevanceScore ?? 0,
        summary: aiScore?.summary ?? '—',
        recommendation: aiScore?.recommendation ?? '—',
        risks: aiScore?.risks ?? [],
        stackFit: aiScore?.stackFit ?? '—',
        link: job.external_id as string,
      }, String(chatId));

      await supabase
        .from('jobs')
        .update({
          status: 'published',
          telegram_message_id: result.messageId,
          telegram_chat_id: result.chatId,
          locked_at: null,
        })
        .eq('id', job.id);

      console.log(`[telegram] Sent job ${job.id as string} → message_id=${result.messageId}`);
      sent++;
    } catch (err) {
      const nextRetryAt = new Date(Date.now() + 15 * 60_000).toISOString();
      await supabase
        .from('jobs')
        .update({
          status: 'publish_failed',
          last_error: (err as Error).message.slice(0, 500),
          next_retry_at: nextRetryAt,
          locked_at: null,
        })
        .eq('id', job.id);

      console.error(`[telegram] Failed job ${job.id as string}:`, (err as Error).message);
      failed++;
    }
  }

  return { sent, failed };
}
