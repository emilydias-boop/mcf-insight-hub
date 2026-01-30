// Supabase client configuration
// Using hardcoded values to ensure consistency across preview/published environments
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoded project configuration (public/anon key is safe to expose)
const SUPABASE_URL = 'https://rehcfgqvigfcekiipqkc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlaGNmZ3F2aWdmY2VraWlwcWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0Nzk1NzgsImV4cCI6MjA3OTA1NTU3OH0.Rab8S7rX6c7N92CufTkaXKJh0jpS9ydHWSmJMaPMVtE';

// Guard: validate config before creating client
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase configuration is missing. Please contact support.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export URL for health checks
export const SUPABASE_PROJECT_URL = SUPABASE_URL;
