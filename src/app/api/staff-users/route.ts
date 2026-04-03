import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/core/supabaseServer';
import {
  deleteStaffAccountByEmail,
  findStaffAccountByEmail,
  updateStaffAccountByEmail,
  verifyStaffPassword,
} from '@/lib/core/supabaseAdmin';

type UpdateOwnAccountBody = {
  staffId?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
};

async function getCurrentUserEmail() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.email ?? null;
}

export async function GET() {
  try {
    const email = await getCurrentUserEmail();

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await findStaffAccountByEmail(email);

    if (!data) {
      return NextResponse.json({ error: 'Staff account not found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load staff accounts.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentEmail = await getCurrentUserEmail();

    if (!currentEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as UpdateOwnAccountBody;
    const nextStaffId = body.staffId?.trim() ?? '';
    const nextEmail = body.email?.trim() ?? '';
    const currentPassword = body.currentPassword ?? '';
    const newPassword = body.newPassword ?? '';

    if (!nextStaffId || !nextEmail) {
      return NextResponse.json(
        { error: 'Staff ID and email are required.' },
        { status: 400 },
      );
    }

    if (newPassword && !currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required before setting a new password.' },
        { status: 400 },
      );
    }

    if (newPassword) {
      const passwordValid = await verifyStaffPassword(currentEmail, currentPassword);

      if (!passwordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 400 },
        );
      }
    }

    const record = await updateStaffAccountByEmail(currentEmail, {
      staffId: nextStaffId,
      email: nextEmail,
      password: newPassword || undefined,
    });

    return NextResponse.json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update account.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const email = await getCurrentUserEmail();

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteStaffAccountByEmail(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Account creation is no longer available on this route.' },
    { status: 405 },
  );
}
