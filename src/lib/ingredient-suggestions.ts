import { prisma } from "./prisma";

export async function getIngredientSuggestions() {
  const rows = await prisma.dishIngredient.findMany({
    select: { name: true, unit: true },
  });

  const nameCounts = new Map<string, number>();
  const unitCounts = new Map<string, number>();

  for (const r of rows) {
    if (r.name) {
      const k = r.name.trim();
      if (k) nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
    }
    if (r.unit) {
      const k = r.unit.trim();
      if (k) unitCounts.set(k, (unitCounts.get(k) ?? 0) + 1);
    }
  }

  const sortByCount = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([v]) => v);

  return {
    names: sortByCount(nameCounts),
    units: sortByCount(unitCounts),
  };
}
