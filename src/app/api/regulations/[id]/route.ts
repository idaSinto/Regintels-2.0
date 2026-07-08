import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  const body = await req.json();
  const { name, regulation_search_profiles } = body;
  const { authority, search_queries, primary_sources, secondary_sources } = regulation_search_profiles || body;

  // Update regulation
  const { error: regError } = await supabase
    .from('regulations')
    .update({ name })
    .eq('id', id);

  if (regError) return NextResponse.json({ error: regError }, { status: 500 });

  const profilePayload: Record<string, unknown> = {
    regulation_id: id,
    authority,
    search_queries: Array.isArray(search_queries) ? search_queries : [],
  };
  if (Array.isArray(primary_sources)) profilePayload.primary_sources = primary_sources;
  if (Array.isArray(secondary_sources)) profilePayload.secondary_sources = secondary_sources;

  const { error: profileError } = await supabase
    .from('regulation_search_profiles')
    .upsert(profilePayload, { onConflict: 'regulation_id' });

  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });

  return NextResponse.json({ success: true });
}




export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);

  const { error } = await supabase
    .from('regulations')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
