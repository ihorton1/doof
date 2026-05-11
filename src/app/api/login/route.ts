import { NextResponse } from "next/server";
import {
  checkPassword,
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password =
    typeof body === "object" && body && "password" in body
      ? String((body as { password: unknown }).password ?? "")
      : "";

  if (!checkPassword(password)) {
    // Tiny delay to slow brute force
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionCookieValue(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
