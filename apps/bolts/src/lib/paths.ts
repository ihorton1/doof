export const BASE_PATH = "/bolts";

export function appPath(path = "/") {
  return `${BASE_PATH}${path}`;
}

export function safeNextPath(value: string | undefined) {
  const origin = "https://bolts.invalid";
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value) || !URL.canParse(value, origin)) return "/";
  const url = new URL(value, origin);
  if (url.origin !== origin || /^\/login(?:\/|$)/.test(url.pathname)) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function actionRedirectUrl(path: string, origin: string | null) {
  if (!origin) throw new Error("Bolts: an Origin header is required for action redirects.");
  return new URL(appPath(path), origin).href;
}
