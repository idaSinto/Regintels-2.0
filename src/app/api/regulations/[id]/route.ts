import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/core/database';

const UpdateRegulationSchema = z.object({
  name: z.string().min(1).max(255),
  authority: z.string().min(1).max(255).optional(),
  search_queries: z.array(z.string().max(500)).max(50).optional(),
  primary_sources: z.array(z.string().url().max(2000)).max(20).nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid regulation ID.' }, { status: 400 });
  }
  const body = await req.json();
  const parsed = UpdateRegulationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, authority, search_queries, primary_sources } = parsed.data;

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
      primary_sources: Array.isArray(primary_sources) ? primary_sources : null
    })
    .eq('regulation_id', id);

  if (profileError) return NextResponse.json({ error: profileError }, { status: 500 });

  return NextResponse.json({ success: true });
}


export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'Invalid regulation ID.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('regulations')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
