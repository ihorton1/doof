"use server";

import { cookies } from "next/headers";
import {
  checkPassword,
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../lib/auth";
import { BASE_PATH, safeNextPath } from "../../lib/paths";
import { redirectAfterAction } from "../../lib/redirect";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  if (!checkPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return redirectAfterAction(`/login/?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set({
    name: SESSION_COOKIE_NAME,
    value: createSessionCookieValue(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: BASE_PATH,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return redirectAfterAction(next);
}

export async function logout() {
  (await cookies()).set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: BASE_PATH,
    maxAge: 0,
  });
  return redirectAfterAction("/login/");
}
