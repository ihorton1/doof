import { getPrisma } from "../../../lib/prisma";
import { activeIdeaWhere, ideaIdSchema } from "../../../lib/ideas";
import { requireSession } from "../../../lib/require-session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const input = ideaIdSchema.safeParse((await params).id);
  const headers = { "Cache-Control": "private, no-store" };
  if (!input.success) return new Response(null, { status: 404, headers });
  try {
    const image = await getPrisma().ideaEntryImage.findFirst({
      where: { id: input.data, entry: { idea: activeIdeaWhere } },
      select: { contentType: true, data: true },
    });
    if (!image) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(image.data), {
      headers: {
        ...headers,
        "Content-Type": image.contentType,
        "Content-Length": String(image.data.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    console.error("Bolts: could not load entry image", error);
    return new Response("This image could not be loaded. Please try again.", { status: 500, headers });
  }
}
