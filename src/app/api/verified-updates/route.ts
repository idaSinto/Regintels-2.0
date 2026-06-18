import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';

// ==========================================
// FETCH LATEST VERIFIED UPDATES
// ==========================================
export async function GET() {
  
  // Query Supabase for verified updates joined with their parent data
  const { data, error } = await supabase
    .from('latest_verified_updates')
    .select(`
      regulation_id,
      verified_updates:verified_update_id(*)
    `)
    // Sort so the newest regulations appear at the top
    .order('deduced_published_date', { ascending: false });

  // Error handling for database connection or query issues
  if (error) {
    console.error('Verified updates API error:', error);
    return NextResponse.json([], { status: 500 });
  }

  // Return the data as a JSON array (or empty array if no data exists)
  return NextResponse.json(data || []);
}
