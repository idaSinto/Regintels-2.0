import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/core/database';

const ImpactLevel = z.enum(['high', 'medium', 'low']);

const CreateKeywordSchema = z.object({
  keyword: z.string().min(1).max(255),
  level: ImpactLevel,
});

const UpdateKeywordSchema = z.object({
  id: z.number().int().positive(),
  level: ImpactLevel,
});

// GET all keywords
export async function GET() {
  const { data, error } = await supabase.from('impact_keywords').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST new keyword
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateKeywordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { keyword, level } = parsed.data;

  const { data, error } = await supabase.from('impact_keywords').insert({ keyword, level });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT: update keyword level
export async function PUT(req: Request) {
  const body = await req.json();
  const parsed = UpdateKeywordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, level } = parsed.data;

  const { data, error } = await supabase.from('impact_keywords').update({ level }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE keyword
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get('id');
  const id = Number(rawId);
  if (!rawId || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid or missing id' }, { status: 400 });
  }

  const { data, error } = await supabase.from('impact_keywords').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
