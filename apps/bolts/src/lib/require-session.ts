import { cookies } from "next/headers";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "./auth";
import { redirectAfterAction } from "./redirect";

export async function requireSession() {
  const value = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(value)) return redirectAfterAction("/login/");
}
