import { fetchRssJobs } from './parseRss.js';
import { saveNewJobs } from './saveJobs.js';

export async function fetchJobs(): Promise<void> {
  console.log('[ingestion] Fetching RSS feeds...');
  const jobs = await fetchRssJobs();
  console.log(`[ingestion] Parsed ${jobs.length} jobs from all sources`);
  const { saved, skipped } = await saveNewJobs(jobs);
  console.log(`[ingestion] Saved: ${saved}, Skipped (duplicates/errors): ${skipped}`);
}
