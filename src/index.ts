import { loadSettings } from './db/settings.js';
import { fetchJobs } from './ingestion/fetchJobs.js';
import { prefilterJobs } from './prefilter/prefilterJobs.js';
import { scoreJobs } from './scoring/scoreJobs.js';
import { notifyUser } from './telegram/notifyUser.js';

async function main(): Promise<void> {
  console.log('[pipeline] Starting freelance-monitor run...');

  console.log('[pipeline] Stage 1: Loading settings');
  const settings = await loadSettings();
  console.log(`[pipeline] Settings: is_bot_active=${settings.is_bot_active}, min_score=${settings.min_score}, sources=[${settings.active_sources.join(', ')}]`);

  if (!settings.is_bot_active) {
    console.log('[pipeline] Bot is disabled in settings. Exiting...');
    process.exit(0);
  }

  // Validate all required fields before doing any work
  const missing: string[] = [];
  if (!settings.telegram_chat_id) missing.push('telegram_chat_id (send /start to the bot)');
  if (!settings.llm_provider)     missing.push('llm_provider');
  if (!settings.llm_api_key)      missing.push('llm_api_key');
  if (!settings.llm_model)        missing.push('llm_model');
  if (settings.active_sources.length === 0) missing.push('active_sources (enable at least one source)');

  if (missing.length > 0) {
    console.error('[pipeline] Cannot start — required settings not configured:');
    missing.forEach((f) => console.error(`  ✗ ${f}`));
    console.error('[pipeline] Fix these in the admin panel and try again.');
    process.exit(1);
  }

  console.log('[pipeline] Stage 2: Ingestion');
  await fetchJobs();

  console.log('[pipeline] Stage 3: Pre-filtering');
  const filter = await prefilterJobs();
  console.log(`[pipeline] Pre-filter: passed=${filter.passed}, rejected=${filter.rejected}`);

  console.log('[pipeline] Stage 4: AI Scoring');
  const scoring = await scoreJobs();
  console.log(`[pipeline] Scoring: publishReady=${scoring.publishReady}, rejected=${scoring.rejected}`);

  console.log('[pipeline] Stage 5: Telegram Delivery');
  const notify = await notifyUser();
  console.log(`[pipeline] Notify: sent=${notify.sent}, failed=${notify.failed}`);

  console.log('[pipeline] Done.');
}

main().then(() => {
  process.exit(0);
}).catch((err: unknown) => {
  console.error('[pipeline] Fatal error:', err);
  process.exit(1);
});
