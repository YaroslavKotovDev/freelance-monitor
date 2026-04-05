import { getSettings } from '../db/settings.js';
import { fetchHnHiringJobs } from './fetchHnHiring.js';
import { fetchRssJobs } from './parseRss.js';
import { saveNewJobs } from './saveJobs.js';

export async function fetchJobs(): Promise<void> {
  console.log('[ingestion] Fetching feeds...');
  const activeSources = getSettings().active_sources;

  const [rssJobs, hnJobs] = await Promise.all([
    fetchRssJobs(activeSources),
    activeSources.includes('hn-hiring') ? fetchHnHiringJobs() : Promise.resolve([]),
  ]);

  const jobs = [...rssJobs, ...hnJobs];
  console.log(`[ingestion] Parsed ${jobs.length} jobs from all sources`);

  const { saved, skipped } = await saveNewJobs(jobs);
  console.log(`[ingestion] Saved: ${saved}, Skipped (duplicates/errors): ${skipped}`);
}
