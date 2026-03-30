import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/core/supabaseMiddleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/api/auth/staff-login',
    '/api/staff-users',
    '/api/latest-verified-updates',
    '/api/verified-updates',
    '/api/regulations/:path*',
    '/api/impact-keywords',
    '/api/run-pipeline',
    '/api/send-newsletter',
  ],
};
