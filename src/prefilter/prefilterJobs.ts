import { supabase } from '../db/supabase.js';
import { getSettings } from '../db/settings.js';

const BATCH_SIZE = 50;
const MAX_AGE_HOURS = 12;

function isRecentEnough(isoDate: string | null): boolean {
  if (!isoDate) return true; // no date = don't filter out
  const pubDate = new Date(isoDate);
  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
  return pubDate >= cutoff;
}

function hasStopWord(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return getSettings().stop_words.some((word) => text.includes(word.toLowerCase()));
}

/** Extract numeric USD amount from budget_text like "$500", "500 USD", "$100-$300" */
function parseBudgetUsd(budgetText: string | null): number | null {
  if (!budgetText) return null;
  const match = budgetText.match(/\$?([\d,]+)/);
  if (!match?.[1]) return null;
  return parseInt(match[1].replace(/,/g, ''), 10);
}

function isBudgetTooLow(budgetText: string | null): boolean {
  const minBudget = getSettings().min_budget_usd;
  if (minBudget <= 0) return false; // filter disabled
  const budget = parseBudgetUsd(budgetText);
  if (budget === null) return false; // no budget = don't filter out
  return budget < minBudget;
}

export async function prefilterJobs(): Promise<{ passed: number; rejected: number }> {
  const { data: jobs, error } = await supabase.rpc('claim_jobs_for_prefilter', {
    batch_size: BATCH_SIZE,
  });

  if (error) {
    return prefilterJobsFallback();
  }

  return processJobs(jobs as Array<{ id: string; title: string; description: string; budget_text: string | null; source_published_at: string | null }>);
}

async function prefilterJobsFallback(): Promise<{ passed: number; rejected: number }> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, description, budget_text, source_published_at')
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Failed to fetch new jobs: ${error.message}`);

  return processJobs(jobs as Array<{ id: string; title: string; description: string; budget_text: string | null; source_published_at: string | null }>);
}

async function processJobs(
  jobs: Array<{ id: string; title: string; description: string; budget_text: string | null; source_published_at: string | null }>,
): Promise<{ passed: number; rejected: number }> {
  let passed = 0;
  let rejected = 0;

  for (const job of jobs) {
    try {
      const rejectReason =
        !isRecentEnough(job.source_published_at) ? 'too_old' :
        hasStopWord(job.title, job.description)  ? 'stop_word' :
        isBudgetTooLow(job.budget_text)          ? 'budget_too_low' :
        null;

      const status = rejectReason ? 'prefilter_rejected' : 'ready_for_llm';

      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', job.id);

      if (error) {
        console.error(`Failed to update job ${job.id}:`, error.message);
        continue;
      }

      if (status === 'ready_for_llm') passed++;
      else {
        console.log(`[prefilter] ${job.id}: rejected (${rejectReason})`);
        rejected++;
      }
    } catch (err) {
      console.error(`Unexpected error processing job ${job.id}:`, err);
    }
  }

  return { passed, rejected };
}
