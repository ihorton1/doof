"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkPassword,
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/today");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/today";

  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 400));
    redirect(`/login?error=1&next=${encodeURIComponent(safeNext)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionCookieValue(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(safeNext);
}
