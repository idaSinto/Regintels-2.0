import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { supabaseAnonKey, supabaseUrl } from '@/lib/core/supabaseAuthConfig';
import { findStaffLoginIdentity } from '@/lib/core/supabaseAdmin';

const appSessionStartedAtCookie = 'regintels_session_started_at';
const appSessionLastSeenAtCookie = 'regintels_session_last_seen_at';
const appSessionMaxAgeHours = Number(process.env.APP_SESSION_MAX_AGE_HOURS ?? '12');
const appSessionMaxAgeSeconds = Math.max(appSessionMaxAgeHours, 1) * 60 * 60;
const appSessionIdleTimeoutMinutes = Number(process.env.APP_SESSION_IDLE_TIMEOUT_MINUTES ?? '15');
const appSessionIdleTimeoutSeconds = Math.max(appSessionIdleTimeoutMinutes, 1) * 60;

type StaffLoginBody = {
  staffId?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as StaffLoginBody;
  const staffId = body.staffId?.trim() ?? '';
  const password = body.password ?? '';

  if (!staffId || !password) {
    return NextResponse.json(
      { error: 'Staff ID and password are required.' },
      { status: 400 },
    );
  }

  const identity = await findStaffLoginIdentity(staffId);

  if (!identity) {
    return NextResponse.json(
      { error: 'Invalid staff ID or inactive staff account.' },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  const response = NextResponse.json({ ok: true });

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

  const { error } = await supabase.auth.signInWithPassword({
    email: identity.email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: 'Invalid staff ID or password.' },
      { status: 401 },
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

  return response;
}
