import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "doof_session";
const SESSION_DURATION_DAYS = 30;

function getSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "COOKIE_SECRET env var must be set to a string of 16+ chars",
    );
  }
  return secret;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionCookieValue(): string {
  const expires = Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const expiresStr = String(expires);
  const sig = sign(expiresStr, getSecret());
  return `${expiresStr}.${sig}`;
}

export function isValidSessionCookie(value: string | undefined): boolean {
  if (!value) return false;
  const [expiresStr, sig] = value.split(".");
  if (!expiresStr || !sig) return false;

  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expectedSig = sign(expiresStr, getSecret());
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;
