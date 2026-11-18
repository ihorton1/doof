import { passwordSession } from "../../../../packages/auth/session";

export const {
  createSessionCookieValue,
  isValidSessionCookie,
  checkPassword,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} = passwordSession({
  cookieName: "bolts_session",
  passwordEnv: "BOLTS_APP_PASSWORD",
  secretEnv: "BOLTS_COOKIE_SECRET",
});
