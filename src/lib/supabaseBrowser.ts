import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedKey = '';

/**
 * Returns a singleton browser Supabase client strictly for Supabase Realtime subscriptions
 * using the public URL + publishable/anon key (never a secret/service key).
 */
export function getOrCreateBrowserSupabaseClient(
  supabaseUrl: string | null,
  supabasePublicKey: string | null,
  authToken?: string | null
): SupabaseClient | null {
  if (!supabaseUrl || !supabasePublicKey) return null;
  const key = `${supabaseUrl}::${supabasePublicKey}`;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    cachedKey = key;
  }

  if (authToken && authToken.split('.').length === 3) {
    try {
      cachedClient.realtime.setAuth(authToken);
    } catch {
      // ignore if realtime auth rejects local tokens
    }
  }

  return cachedClient;
}
