import { NextResponse } from 'next/server';
import { supabase } from '@/lib/core/database';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const body = await req.json();
  const { name, authority, search_queries, primary_sources, secondary_sources } = body;

  // Update regulation
  const { error: regError } = await supabase
    .from('regulations')
    .update({ name })
    .eq('id', id);

  if (regError) return NextResponse.json({ error: regError }, { status: 500 });

  // Update profile (ARRAY directly, not JSON string)
  const { error: profileError } = await supabase
    .from('regulation_search_profiles')
    .update({
      authority,
      search_queries: Array.isArray(search_queries) ? search_queries : [],
      primary_sources: Array.isArray(primary_sources) ? primary_sources : null,
      secondary_sources: Array.isArray(secondary_sources) ? secondary_sources : null
    })
    .eq('regulation_id', id);

  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });

  return NextResponse.json({ success: true });
}


export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);

  const { error } = await supabase
    .from('regulations')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
