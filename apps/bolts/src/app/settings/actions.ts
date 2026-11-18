"use server";

import { cookies } from "next/headers";
import { requireSession } from "../../lib/require-session";
import { BASE_PATH } from "../../lib/paths";
import { THEME_COOKIE_NAME, getTheme, themeSchema, type ThemeState } from "../../lib/theme";

export async function setTheme(_previous: ThemeState, formData: FormData): Promise<ThemeState> {
  await requireSession();
  const cookieStore = await cookies();
  const input = themeSchema.safeParse(formData.get("theme"));
  if (!input.success) return { theme: getTheme(cookieStore.get(THEME_COOKIE_NAME)?.value), error: input.error.issues[0].message };
  cookieStore.set({
    name: THEME_COOKIE_NAME,
    value: input.data,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: BASE_PATH,
    maxAge: 60 * 60 * 24 * 365,
  });
  return { theme: input.data, saved: true };
}
