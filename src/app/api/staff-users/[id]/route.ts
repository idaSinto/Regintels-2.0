import { NextResponse } from 'next/server';

import { deleteStaffAccount, updateStaffAccount } from '@/lib/core/supabaseAdmin';

type UpdateStaffUserBody = {
  staffId?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
};

function parseId(id: string) {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const id = parseId(params.id);

  if (id === null) {
    return NextResponse.json({ error: 'Invalid staff user id.' }, { status: 400 });
  }

  const body = (await request.json()) as UpdateStaffUserBody;

  try {
    const record = await updateStaffAccount(id, body);
    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update staff user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const id = parseId(params.id);

  if (id === null) {
    return NextResponse.json({ error: 'Invalid staff user id.' }, { status: 400 });
  }

  try {
    await deleteStaffAccount(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete staff user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
