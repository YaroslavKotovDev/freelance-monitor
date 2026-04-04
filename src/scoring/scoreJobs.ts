import { supabase } from '../db/supabase.js';
import { callLlm } from './llm.js';

const RELEVANCE_THRESHOLD = 85;
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 4;

function backoffMinutes(attempt: number): number {
  const schedule = [15, 60, 360]; // 15min, 1h, 6h
  return schedule[attempt - 1] ?? 720; // 12h fallback
}

export async function scoreJobs(): Promise<{ publishReady: number; rejected: number }> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, description, budget_text, source, attempt_count')
    .eq('status', 'ready_for_llm')
    .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Failed to fetch ready_for_llm jobs: ${error.message}`);

  let publishReady = 0;
  let rejected = 0;

  for (const job of jobs) {
    const attemptCount = (job.attempt_count as number) ?? 0;

    // Mark as llm_processing atomically
    await supabase
      .from('jobs')
      .update({ status: 'llm_processing', locked_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'ready_for_llm');

    try {
      const aiScore = await callLlm(
        job.title as string,
        job.description as string,
        (job.budget_text as string | null) ?? null,
        job.source as string,
      );

      const status = aiScore.relevanceScore >= RELEVANCE_THRESHOLD ? 'publish_ready' : 'llm_rejected';

      await supabase
        .from('jobs')
        .update({ status, ai_score: aiScore, attempt_count: attemptCount + 1 })
        .eq('id', job.id);

      console.log(`[scoring] ${job.id as string}: score=${aiScore.relevanceScore} → ${status}`);

      if (status === 'publish_ready') publishReady++;
      else rejected++;
    } catch (err) {
      const nextAttempt = attemptCount + 1;
      const isTerminal = nextAttempt >= MAX_ATTEMPTS;
      const nextRetryAt = new Date(Date.now() + backoffMinutes(nextAttempt) * 60_000).toISOString();

      await supabase
        .from('jobs')
        .update({
          status: isTerminal ? 'llm_failed' : 'ready_for_llm',
          attempt_count: nextAttempt,
          last_error: (err as Error).message.slice(0, 500),
          next_retry_at: isTerminal ? null : nextRetryAt,
          locked_at: null,
        })
        .eq('id', job.id);

      console.error(`[scoring] ${job.id as string}: attempt ${nextAttempt}/${MAX_ATTEMPTS} failed — ${(err as Error).message}`);
    }
  }

  return { publishReady, rejected };
}
