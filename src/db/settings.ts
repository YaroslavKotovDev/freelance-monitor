import { supabase } from './supabase.js';

export interface AppSettings {
  is_bot_active: boolean;
  stop_words: string[];
  min_score: number;
  active_sources: string[];
  telegram_chat_id: number | null;
  llm_provider: string | null;
  llm_api_key: string | null;
  llm_model: string | null;
}

let cached: AppSettings | null = null;

export async function loadSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('is_bot_active, stop_words, min_score, active_sources, telegram_chat_id, llm_provider, llm_api_key, llm_model')
    .eq('id', 1)
    .single();

  if (error) throw new Error(`Failed to load app_settings: ${error.message}`);

  cached = {
    is_bot_active: data.is_bot_active as boolean,
    stop_words: data.stop_words as string[],
    min_score: data.min_score as number,
    active_sources: data.active_sources as string[],
    telegram_chat_id: data.telegram_chat_id as number | null,
    llm_provider: data.llm_provider as string | null,
    llm_api_key: data.llm_api_key as string | null,
    llm_model: data.llm_model as string | null,
  };

  return cached;
}

/** Returns in-memory cached settings. Throws if loadSettings() was not called first. */
export function getSettings(): AppSettings {
  if (!cached) throw new Error('Settings not loaded — call loadSettings() first');
  return cached;
}
