import { prisma } from "@/lib/prisma";

export function dishImagePath(id: string, updatedAt: Date): string {
  return `/api/dishes/${encodeURIComponent(id)}/image?v=${updatedAt.getTime()}`;
}

export async function getDishIdsWithImages(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Dish"
    WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> ''
  `;

  return new Set(rows.map((row) => row.id));
}
