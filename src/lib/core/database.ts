// Supabase Configurations
import { createClient } from '@supabase/supabase-js';

// Using keys from .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY is missing');

// Create server-side client
export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// TYPES
// ==========================================
export type RegulationSearchProfile = {
  authority: string;
  search_queries: string[];
  primary_sources: string[] | null;
  secondary_sources: string[] | null;
};

export type RegulationWithProfile = {
  id: number;
  name: string;
  profile: RegulationSearchProfile;
};

// ==========================================
// HELPERS
// ==========================================
export async function getActiveRegulationsWithProfile(): Promise<RegulationWithProfile[]> {
  const { data, error } = await supabase
    .from('regulations')
    .select(`
      id,
      name,
      regulation_search_profiles (
        authority,
        search_queries,
        primary_sources,
        secondary_sources
      )
    `)
    .eq('is_active', true);

  if (error) throw error;

  return (data ?? [])
    .map(reg => {
      const profile = reg.regulation_search_profiles?.[0];
      if (!profile) return null;

      return {
        id: reg.id,
        name: reg.name,
        profile,
      };
    })
    .filter(Boolean) as RegulationWithProfile[];
}



