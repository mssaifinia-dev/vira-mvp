import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // تصاویر: 30 روز
  if (request.nextUrl.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=2592000, immutable');
  }

  // HTML: 1 ساعت
  if (request.nextUrl.pathname.endsWith('.html') || !request.nextUrl.pathname.includes('.')) {
    response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  }

  // JS/CSS: 1 سال
  if (request.nextUrl.pathname.match(/\.(js|css)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};