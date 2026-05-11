import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isValidSessionCookie(cookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)",
  ],
};
