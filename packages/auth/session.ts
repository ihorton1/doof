import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function passwordSession(options: {
  cookieName: string;
  passwordEnv: string;
  secretEnv: string;
}) {
  function getSecret() {
    const secret = process.env[options.secretEnv];
    if (!secret || secret.length < 16) {
      throw new Error(`${options.secretEnv} env var must be set to a string of 16+ chars`);
    }
    return secret;
  }

  function sign(value: string) {
    return createHmac("sha256", getSecret()).update(value).digest("hex");
  }

  return {
    SESSION_COOKIE_NAME: options.cookieName,
    SESSION_MAX_AGE_SECONDS,
    createSessionCookieValue() {
      const expires = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
      return `${expires}.${sign(expires)}`;
    },
    isValidSessionCookie(value: string | undefined) {
      if (!value) return false;
      const [expires, signature, extra] = value.split(".");
      if (!expires || !signature || extra !== undefined) return false;
      const timestamp = Number(expires);
      if (!Number.isFinite(timestamp) || timestamp < Date.now()) return false;
      if (!/^[a-f0-9]{64}$/.test(signature)) return false;
      return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(expires), "hex"));
    },
    checkPassword(input: string) {
      const expected = process.env[options.passwordEnv];
      if (!expected) throw new Error(`${options.passwordEnv} env var must be set`);
      const a = Buffer.from(input);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}
