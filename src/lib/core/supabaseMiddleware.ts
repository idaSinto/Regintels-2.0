import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseUrl } from './supabaseAuthConfig';

const appSessionStartedAtCookie = 'regintels_session_started_at';
const appSessionLastSeenAtCookie = 'regintels_session_last_seen_at';
const appSessionMaxAgeHours = Number(process.env.APP_SESSION_MAX_AGE_HOURS ?? '12');
const appSessionMaxAgeMs = Math.max(appSessionMaxAgeHours, 1) * 60 * 60 * 1000;
const appSessionIdleTimeoutMinutes = Number(process.env.APP_SESSION_IDLE_TIMEOUT_MINUTES ?? '15');
const appSessionIdleTimeoutMs = Math.max(appSessionIdleTimeoutMinutes, 1) * 60 * 1000;

const protectedPrefixes = [
  '/dashboard',
  '/api/latest-verified-updates',
  '/api/verified-updates',
  '/api/regulations',
  '/api/impact-keywords',
  '/api/run-pipeline',
  '/api/send-newsletter',
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name === appSessionStartedAtCookie ||
      cookie.name === appSessionLastSeenAtCookie
    ) {
      response.cookies.delete(cookie.name);
    }
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const protectedPath = isProtectedPath(pathname);
  const startedAtCookie = request.cookies.get(appSessionStartedAtCookie)?.value;
  const lastSeenAtCookie = request.cookies.get(appSessionLastSeenAtCookie)?.value;
  const startedAt = startedAtCookie ? Number(startedAtCookie) : NaN;
  const lastSeenAt = lastSeenAtCookie ? Number(lastSeenAtCookie) : NaN;
  const sessionExpired = Number.isFinite(startedAt) && Date.now() - startedAt > appSessionMaxAgeMs;
  const idleExpired = Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt > appSessionIdleTimeoutMs;
  const sessionInvalid = !startedAtCookie || !lastSeenAtCookie || sessionExpired || idleExpired;

  if (!user && protectedPath) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(homeUrl);
  }

  if (user && protectedPath && sessionInvalid) {
    if (pathname.startsWith('/api/')) {
      const expiredResponse = NextResponse.json(
        { error: 'Session expired. Please sign in again.' },
        { status: 401 },
      );
      clearAuthCookies(request, expiredResponse);
      return expiredResponse;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    loginUrl.searchParams.set('reason', 'expired');

    const expiredResponse = NextResponse.redirect(loginUrl);
    clearAuthCookies(request, expiredResponse);
    return expiredResponse;
  }

  if (user && (pathname === '/login' || pathname === '/signup') && !sessionInvalid) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  if (!user) {
    clearAuthCookies(request, response);
  }

  if (user && !sessionInvalid) {
    response.cookies.set(appSessionLastSeenAtCookie, String(Date.now()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: appSessionIdleTimeoutMinutes * 60,
    });
  }

  return response;
}
