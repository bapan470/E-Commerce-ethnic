import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from './lib/admin-auth';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only handle /admin routes (excluding /admin/login)
  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (pathname === '/admin/login') return NextResponse.next();

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE);
  const token = cookie?.value ?? null;
  const verified = await verifyAdminToken(token);
  if (verified.valid) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/admin/login', req.url);
  loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*'],
};
