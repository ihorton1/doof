import { normalizeImageUrl } from "./image-url";

const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

export function dishImageResponse(imageUrl: string | null | undefined): Response {
  if (!imageUrl) {
    return new Response(null, { status: 404 });
  }

  const match = DATA_URL_PATTERN.exec(imageUrl);
  if (!match) {
    const remoteUrl = normalizeImageUrl(imageUrl);
    if (remoteUrl) {
      return new Response(null, {
        status: 307,
        headers: {
          Location: remoteUrl,
          "Cache-Control": "private, no-cache",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
    return new Response(null, { status: 415 });
  }

  const bytes = Buffer.from(match[2], "base64");
  return new Response(bytes, {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Length": String(bytes.byteLength),
      "Content-Type": match[1],
      "X-Content-Type-Options": "nosniff",
    },
  });
}
