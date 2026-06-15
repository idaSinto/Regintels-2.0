import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/core/database';

const CreateRegulationSchema = z.object({
  name: z.string().min(1).max(255),
  regulation_search_profiles: z.object({
    authority: z.string().min(1).max(255).optional(),
    search_queries: z.array(z.string().max(500)).max(50).optional(),
    primary_sources: z.array(z.string().url().max(2000)).max(20).nullable().optional(),
  }).optional(),
});

export async function GET() {
  const { data, error } = await supabase
    .from('regulations')
    .select(`
      id,
      name,
      last_scanned_at,
      regulation_search_profiles (
        authority,
        search_queries,
        primary_sources
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}


export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateRegulationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, regulation_search_profiles } = parsed.data;
  const { authority, search_queries, primary_sources } = regulation_search_profiles ?? {};

  // Step 1: create regulation
  const { data: regData, error: regError } = await supabase
    .from('regulations')
    .insert([{ name, is_active: true }])
    .select()
    .single();

  if (regError) return NextResponse.json({ error: regError }, { status: 500 });

  // Step 2: create search profile
  const { data: profileData, error: profileError } = await supabase
    .from('regulation_search_profiles')
    .insert([{
      regulation_id: regData.id,
      authority,
      search_queries: Array.isArray(search_queries) ? search_queries : [],
      primary_sources: Array.isArray(primary_sources) ? primary_sources : null
    }]);

  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });

  return NextResponse.json({ regulation: regData, profile: profileData });
}


