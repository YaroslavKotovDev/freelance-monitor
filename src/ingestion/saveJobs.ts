import { supabase } from '../db/supabase.js';
import type { JobInput } from '../types.js';

export async function saveNewJobs(jobs: JobInput[]): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  for (const job of jobs) {
    try {
      const { error } = await supabase
        .from('jobs')
        .insert({ ...job, status: 'new' });

      if (error) {
        // 23505 = unique_violation — already exists, safe to skip
        if (error.code === '23505') {
          skipped++;
        } else {
          console.error(`Failed to save job "${job.external_id}":`, error.message);
          skipped++;
        }
      } else {
        saved++;
      }
    } catch (err) {
      console.error(`Unexpected error saving job "${job.external_id}":`, err);
      skipped++;
    }
  }

  return { saved, skipped };
}
