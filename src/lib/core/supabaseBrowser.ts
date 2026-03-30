import { createBrowserClient } from '@supabase/ssr';

import { supabaseAnonKey, supabaseUrl } from './supabaseAuthConfig';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}
