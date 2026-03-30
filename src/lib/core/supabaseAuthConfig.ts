const browserSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const browserSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!browserSupabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
}

if (!browserSupabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
}

export const supabaseUrl: string = browserSupabaseUrl;
export const supabaseAnonKey: string = browserSupabaseAnonKey;
