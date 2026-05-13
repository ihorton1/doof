import { prisma } from "./prisma";

export async function getTagSuggestions(): Promise<string[]> {
  const rows = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}
