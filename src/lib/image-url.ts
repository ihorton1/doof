import ipaddr from "ipaddr.js";

export function normalizeImageUrl(value: string, baseUrl?: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value.trim(), baseUrl);
  } catch {
    return undefined;
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username || url.password || url.port || url.href.length > 4000 ||
    (!ipaddr.isValid(hostname) && !hostname.includes(".")) ||
    hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
    (ipaddr.isValid(hostname) && ipaddr.parse(hostname).range() !== "unicast")
  ) {
    return undefined;
  }
  return url.href;
}
