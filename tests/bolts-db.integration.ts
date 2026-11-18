import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { config } from "dotenv";
import { getPrisma } from "../apps/bolts/src/lib/prisma";
import { activeIdeaWhere, ideaFeedSelect } from "../apps/bolts/src/lib/ideas";

config({ path: path.resolve(import.meta.dirname, "../apps/bolts/.env"), quiet: true });

test("Bolts persists ideas and dated entries only in its isolated development database", async () => {
  const prisma = getPrisma();
  const ids: string[] = [];
  try {
    const databases = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    assert.equal(databases[0].name, "bolts_dev", "Refusing to write test data outside bolts_dev");
    const originalDate = new Date("2026-01-01T00:00:00Z");
    const first = await prisma.idea.create({
      data: { title: "Integration test: first idea", updatedAt: originalDate },
    });
    ids.push(first.id);
    const second = await prisma.idea.create({ data: { title: "Integration test: second idea" } });
    ids.push(second.id);

    await prisma.idea.update({
      where: { id: first.id },
      data: {
        updatedAt: new Date(),
        entries: {
          create: [
            { content: "An earlier discovery", createdAt: originalDate },
            { content: "Another thought\nwith two lines." },
          ],
        },
      },
    });

    const reread = await prisma.idea.findUniqueOrThrow({
      where: { id: first.id },
      include: { entries: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    assert.equal(reread.title, first.title);
    assert.ok(reread.updatedAt > originalDate);
    assert.deepEqual(reread.entries.map((entry) => entry.content), [
      "An earlier discovery", "Another thought\nwith two lines.",
    ]);
    assert.ok(reread.entries[1].createdAt instanceof Date);
    assert.ok(reread.entries[1].createdAt >= first.createdAt);
    assert.equal(await prisma.ideaEntry.count({ where: { ideaId: second.id } }), 0);

    const summary = await prisma.idea.findUniqueOrThrow({
      where: { id: first.id },
      select: ideaFeedSelect,
    });
    assert.equal(summary._count.entries, 2);
    assert.equal(summary.entries.length, 1);
    assert.equal(summary.entries[0].content, "Another thought\nwith two lines.");
    assert.equal(summary.entries[0].createdAt.toISOString(), reread.entries[1].createdAt.toISOString());
    const emptySummary = await prisma.idea.findUniqueOrThrow({
      where: { id: second.id },
      select: ideaFeedSelect,
    });
    assert.deepEqual(emptySummary.entries, []);

    const deletedAt = new Date();
    await prisma.idea.update({
      where: { id: first.id, ...activeIdeaWhere },
      data: { deletedAt },
    });
    const retained = await prisma.idea.findUniqueOrThrow({
      where: { id: first.id },
      include: { entries: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    assert.equal(retained.deletedAt?.toISOString(), deletedAt.toISOString());
    assert.deepEqual(retained.entries, reread.entries, "Soft deletion must retain all original entries");
    assert.equal(await prisma.idea.findUnique({ where: { id: first.id, ...activeIdeaWhere } }), null);
    const active = await prisma.idea.findMany({
      where: { id: { in: ids }, ...activeIdeaWhere },
      select: ideaFeedSelect,
    });
    assert.deepEqual(active.map((idea) => idea.id), [second.id]);
    await assert.rejects(prisma.idea.update({
      where: { id: first.id, ...activeIdeaWhere },
      data: { entries: { create: { content: "This stale entry must not be added" } } },
    }), { code: "P2025" });
    assert.equal(await prisma.ideaEntry.count({ where: { ideaId: first.id } }), 2);

    await prisma.idea.delete({ where: { id: first.id } });
    assert.equal(await prisma.ideaEntry.count({ where: { ideaId: first.id } }), 0);
  } finally {
    if (ids.length > 0) await prisma.idea.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
