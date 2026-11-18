import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/icon", "/apple-icon", "/api/health"];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (isValidSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
