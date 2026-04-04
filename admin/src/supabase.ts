import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
}

// Uses the ANON key — RLS policies control what the user can do.
// Service role key is NEVER used on the frontend.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
