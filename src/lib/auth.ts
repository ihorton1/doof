import { passwordSession } from "../../packages/auth/session";

export const {
  createSessionCookieValue,
  isValidSessionCookie,
  checkPassword,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} = passwordSession({
  cookieName: "doof_session",
  passwordEnv: "APP_PASSWORD",
  secretEnv: "COOKIE_SECRET",
});
