import { supabase } from '../db/supabase.js';
import { STOP_WORDS } from './stopWords.js';

const BATCH_SIZE = 50;

function isRejected(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return STOP_WORDS.some((word) => text.includes(word.toLowerCase()));
}

function isTodayOrNewer(isoDate: string | null): boolean {
  if (!isoDate) return true; // no date = don't filter out
  const pubDate = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return pubDate >= today;
}

export async function prefilterJobs(): Promise<{ passed: number; rejected: number }> {
  // Atomic claim: transition new → prefilter_processing
  const { data: jobs, error } = await supabase.rpc('claim_jobs_for_prefilter', {
    batch_size: BATCH_SIZE,
  });

  if (error) {
    // Fallback if RPC not available: simple select (less safe but works)
    return prefilterJobsFallback();
  }

  return processJobs(jobs as Array<{ id: string; title: string; description: string; source_published_at: string | null }>);
}

async function prefilterJobsFallback(): Promise<{ passed: number; rejected: number }> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, description, source_published_at')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Failed to fetch new jobs: ${error.message}`);

  return processJobs(jobs as Array<{ id: string; title: string; description: string; source_published_at: string | null }>);
}

async function processJobs(
  jobs: Array<{ id: string; title: string; description: string; source_published_at: string | null }>,
): Promise<{ passed: number; rejected: number }> {
  let passed = 0;
  let rejected = 0;

  for (const job of jobs) {
    try {
      // Filter out jobs not from today
      if (!isTodayOrNewer(job.source_published_at)) {
        const { error } = await supabase
          .from('jobs')
          .update({ status: 'prefilter_rejected' })
          .eq('id', job.id);
        if (!error) rejected++;
        continue;
      }

      const status = isRejected(job.title, job.description)
        ? 'prefilter_rejected'
        : 'ready_for_llm';

      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', job.id);

      if (error) {
        console.error(`Failed to update job ${job.id}:`, error.message);
        continue;
      }

      if (status === 'ready_for_llm') passed++;
      else rejected++;
    } catch (err) {
      console.error(`Unexpected error processing job ${job.id}:`, err);
    }
  }

  return { passed, rejected };
}
