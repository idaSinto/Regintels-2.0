import { NextResponse } from 'next/server';

import { createStaffAccount, listStaffAccounts } from '@/lib/core/supabaseAdmin';

type CreateStaffUserBody = {
  staffId?: string;
  email?: string;
  password?: string;
};

export async function GET() {
  try {
    const data = await listStaffAccounts();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load staff accounts.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateStaffUserBody;
  const staffId = body.staffId?.trim() ?? '';
  const email = body.email?.trim() ?? '';
  const password = body.password ?? '';

  if (!staffId || !email || !password) {
    return NextResponse.json(
      { error: 'Staff ID, email, and password are required.' },
      { status: 400 },
    );
  }

  try {
    const record = await createStaffAccount({
      staffId,
      email,
      password,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create staff user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
