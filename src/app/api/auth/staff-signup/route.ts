import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { supabaseAnonKey, supabaseUrl } from '@/lib/core/supabaseAuthConfig';
import { signUpStaffAccount } from '@/lib/core/supabaseAdmin';

const appSessionStartedAtCookie = 'regintels_session_started_at';
const appSessionLastSeenAtCookie = 'regintels_session_last_seen_at';
const appSessionMaxAgeHours = Number(process.env.APP_SESSION_MAX_AGE_HOURS ?? '12');
const appSessionMaxAgeSeconds = Math.max(appSessionMaxAgeHours, 1) * 60 * 60;
const appSessionIdleTimeoutMinutes = Number(process.env.APP_SESSION_IDLE_TIMEOUT_MINUTES ?? '15');
const appSessionIdleTimeoutSeconds = Math.max(appSessionIdleTimeoutMinutes, 1) * 60;

type StaffSignupBody = {
  staffId?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as StaffSignupBody;
  const staffId = body.staffId?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  const confirmPassword = body.confirmPassword ?? '';

  if (!staffId || !email || !password || !confirmPassword) {
    return NextResponse.json(
      { error: 'Staff ID, email, password, and confirm password are required.' },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Password confirmation does not match.' }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const response = NextResponse.json({ ok: true }, { status: 201 });
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const record = await signUpStaffAccount({
      staffId,
      email,
      password,
    });

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return NextResponse.json(
        { error: loginError.message || 'Account created, but automatic sign-in failed.' },
        { status: 500 },
      );
    }

    response.cookies.set(appSessionStartedAtCookie, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: appSessionMaxAgeSeconds,
    });

    response.cookies.set(appSessionLastSeenAtCookie, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: appSessionIdleTimeoutSeconds,
    });

    const finalResponse = NextResponse.json(record, { status: 201 });

    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie);
    });

    return finalResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create account.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
