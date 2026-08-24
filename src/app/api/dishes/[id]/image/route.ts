import { prisma } from "@/lib/prisma";

const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dish = await prisma.dish.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  if (!dish?.imageUrl) {
    return new Response(null, { status: 404 });
  }

  const match = DATA_URL_PATTERN.exec(dish.imageUrl);
  if (!match) {
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
