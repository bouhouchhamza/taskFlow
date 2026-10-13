import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && publishableKey);

// Only the publishable key may be exposed in a Vite frontend.
// NEVER put a secret/service_role key in VITE_ variables.
export const supabase = isConfigured
  ? createClient(url, publishableKey)
  : null;
