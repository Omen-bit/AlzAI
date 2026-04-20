import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Guard against top-level initialization crashes
if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase infrastructure keys are missing. Application will boot to validation mode.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
)
