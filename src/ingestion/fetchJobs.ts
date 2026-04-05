import { supabase } from '../db/supabase.js';
import { getSettings } from '../db/settings.js';
import { fetchHnHiringJobs } from './fetchHnHiring.js';
import { fetchRssJobs } from './parseRss.js';
import { saveNewJobs } from './saveJobs.js';

export async function fetchJobs(): Promise<void> {
  console.log('[ingestion] Fetching feeds...');
  const activeSources = getSettings().active_sources;

  const [rssResult, hnJobs] = await Promise.all([
    fetchRssJobs(activeSources),
    activeSources.includes('hn-hiring') ? fetchHnHiringJobs() : Promise.resolve([]),
  ]);

  const { jobs: rssJobs, health } = rssResult;

  // Record HN health
  const hnHealthKey = 'hn-hiring';
  if (activeSources.includes(hnHealthKey)) {
    health[hnHealthKey] = { ok: true, last_run: new Date().toISOString(), error: null };
  }

  // Persist source health to DB (best-effort, don't fail the pipeline)
  if (Object.keys(health).length > 0) {
    supabase
      .from('app_settings')
      .update({ source_health: health })
      .eq('id', 1)
      .then(({ error }) => {
        if (error) console.warn('[ingestion] Failed to save source health:', error.message);
      });
  }

  const jobs = [...rssJobs, ...hnJobs];
  console.log(`[ingestion] Parsed ${jobs.length} jobs from all sources`);

  const { saved, skipped } = await saveNewJobs(jobs);
  console.log(`[ingestion] Saved: ${saved}, Skipped (duplicates/errors): ${skipped}`);
}
