import assert from "node:assert/strict";
import path from "node:path";
import { after, test } from "node:test";
import { config } from "dotenv";
import { getPrisma } from "../apps/bolts/src/lib/prisma";
import { activeIdeaWhere, ideaFeedSelect } from "../apps/bolts/src/lib/ideas";
import { getIdeaPage, type IdeaPageRequest } from "../apps/bolts/src/lib/idea-feed";
import { randomUUID } from "node:crypto";
import { parseEntryContent } from "../apps/bolts/src/lib/entry-todos";

config({ path: path.resolve(import.meta.dirname, "../apps/bolts/.env"), quiet: true });
after(() => getPrisma().$disconnect());

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
    assert.ok(reread.entries.every((entry) => !entry.isTodo && entry.completedAt === null));
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
  }
});

test("to-do completion persists independently of notes, links and bolt scheduling", async () => {
  const prisma = getPrisma();
  const databases = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  assert.equal(databases[0].name, "bolts_dev", "Refusing to write test data outside bolts_dev");
  const idea = await prisma.idea.create({
    data: {
      title: `Todo integration ${randomUUID()}`,
      dueAt: new Date("2100-01-01T00:00:00Z"),
      pendingDismissal: true,
      entries: { create: [
        parseEntryContent("[] Read https://example.com/article"),
        { content: "Keep this note" },
      ] },
    },
    include: { entries: true },
  });
  try {
    const todo = idea.entries.find((entry) => entry.isTodo)!;
    const note = idea.entries.find((entry) => !entry.isTodo)!;
    const completedAt = new Date("2026-11-22T12:00:00Z");
    const where = { id: todo.id, ideaId: idea.id, isTodo: true, idea: activeIdeaWhere };
    assert.equal((await prisma.ideaEntry.updateMany({ where, data: { completedAt } })).count, 1);
    assert.equal((await prisma.ideaEntry.findUniqueOrThrow({ where: { id: todo.id } })).completedAt?.toISOString(), completedAt.toISOString());
    assert.equal((await prisma.ideaEntry.updateMany({ where: { ...where, id: note.id }, data: { completedAt } })).count, 0);
    const reread = await prisma.idea.findUniqueOrThrow({ where: { id: idea.id }, select: ideaFeedSelect });
    assert.equal(reread.dueAt.toISOString(), idea.dueAt.toISOString());
    const unchanged = await prisma.idea.findUniqueOrThrow({ where: { id: idea.id } });
    assert.equal(unchanged.updatedAt.toISOString(), idea.updatedAt.toISOString());
    assert.equal(unchanged.pendingDismissal, true);
    assert.equal((await prisma.ideaEntry.findUniqueOrThrow({ where: { id: note.id } })).completedAt, null);
    assert.equal((await prisma.ideaEntry.findUniqueOrThrow({ where: { id: todo.id } })).content, "Read https://example.com/article");
    assert.equal((await prisma.ideaEntry.updateMany({ where, data: { completedAt: null } })).count, 1);
    assert.equal((await prisma.ideaEntry.findUniqueOrThrow({ where: { id: todo.id } })).completedAt, null);
    await prisma.idea.update({ where: { id: idea.id }, data: { deletedAt: new Date() } });
    assert.equal((await prisma.ideaEntry.updateMany({ where, data: { completedAt } })).count, 0);
  } finally {
    await prisma.idea.delete({ where: { id: idea.id } });
  }
});

test("due pagination and literal search stay complete across ties and removed cursor rows", async () => {
  const prisma = getPrisma();
  const ids: string[] = [];
  const marker = `schedule-${randomUUID()}`;
  try {
    const databases = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    assert.equal(databases[0].name, "bolts_dev", "Refusing to write test data outside bolts_dev");
    for (let i = 0; i < 23; i++) {
      const idea = await prisma.idea.create({
        data: {
          title: `${marker} ${i}`,
          dueAt: new Date(i < 15 ? "1900-01-01T00:00:00Z" : "1900-01-02T00:00:00Z"),
          createdAt: new Date(i < 8 ? "1899-01-01T00:00:00Z" : "1899-01-02T00:00:00Z"),
        },
      });

      ids.push(idea.id);
    }
    const future = await prisma.idea.create({
      data: {
        title: `${marker} future`,
        dueAt: new Date("2100-01-01T00:00:00Z"),
        entries: { create: [
          { content: `${marker} literal 50%_\\ match`, createdAt: new Date("2020-01-01T00:00:00Z") },
          { content: "Latest entry does not contain the search phrase" },
        ] },
      },
    });
    ids.push(future.id);
    const expected = await prisma.idea.findMany({
      where: { id: { in: ids.slice(0, 23) } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });
    const request: IdeaPageRequest = { kind: "due", asOf: "1901-01-01T00:00:00.000Z", cursor: null };
    const first = await getIdeaPage(request);
    assert.equal(first.ideas.length, 10);
    assert.deepEqual(first.ideas.map((idea) => idea.id), expected.slice(0, 10).map((idea) => idea.id));
    assert.ok(first.nextCursor);
    const removedId = first.nextCursor.id;
    await prisma.idea.update({ where: { id: removedId }, data: { deletedAt: new Date() } });
    const second = await getIdeaPage({ ...request, cursor: first.nextCursor });
    assert.equal(second.ideas.length, 10);
    assert.ok(second.nextCursor);
    await prisma.idea.update({ where: { id: second.nextCursor.id }, data: { dueAt: new Date("2100-01-01T00:00:00Z") } });
    const third = await getIdeaPage({ ...request, cursor: second.nextCursor });
    assert.equal(third.ideas.length, 3);
    assert.equal(third.nextCursor, null);
    assert.deepEqual(
      [...first.ideas, ...second.ideas, ...third.ideas].map((idea) => idea.id),
      expected.map((idea) => idea.id),
    );
    const literal = await getIdeaPage({ kind: "search", query: `${marker.toUpperCase()} literal 50%_\\`, cursor: null });
    assert.deepEqual(literal.ideas.map((idea) => idea.id), [future.id]);
    assert.equal(literal.ideas[0].entries[0].content, "Latest entry does not contain the search phrase");
    const titles = await getIdeaPage({ kind: "search", query: marker.toUpperCase(), cursor: null });
    assert.equal(titles.ideas.length, 10);
    assert.ok(titles.nextCursor);
    assert.ok(titles.ideas.every((idea) => idea.id !== removedId));
    const match = await getIdeaPage({ kind: "search", query: `${marker} future`, cursor: null });
    assert.deepEqual(match.ideas.map((idea) => idea.id), [future.id]);
    await prisma.idea.update({
      where: { id: future.id },
      data: { archivedAt: new Date(), dueAt: new Date("1900-01-01T00:00:00Z") },
    });
    const archivedSearch = await getIdeaPage({ kind: "search", query: `${marker} future`, cursor: null });
    assert.deepEqual(archivedSearch.ideas.map((idea) => idea.id), [future.id]);
    assert.ok(archivedSearch.ideas[0].archivedAt instanceof Date);
    const dueIds: string[] = [];
    let remaining = await getIdeaPage(request);
    dueIds.push(...remaining.ideas.map((idea) => idea.id));
    while (remaining.nextCursor) {
      remaining = await getIdeaPage({ ...request, cursor: remaining.nextCursor });
      dueIds.push(...remaining.ideas.map((idea) => idea.id));
    }
    assert.ok(!dueIds.includes(future.id), "Archived bolts must not appear on any due page");
    const archivedDetail = await prisma.idea.findUniqueOrThrow({ where: { id: future.id }, include: { entries: true } });
    assert.equal(archivedDetail.entries.length, 2, "Archiving must retain all entries");
  } finally {
    if (ids.length > 0) await prisma.idea.deleteMany({ where: { id: { in: ids } } });
  }
});

test("entry images persist in order without entering feed payloads, survive archive and are hidden on deletion", async () => {
  const prisma = getPrisma();
  let ideaId: string | undefined;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  try {
    const databases = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    assert.equal(databases[0].name, "bolts_dev", "Refusing to write test data outside bolts_dev");
    const idea = await prisma.idea.create({
      data: { title: `Image integration ${randomUUID()}`, pendingDismissal: true, entries: { create: {
        content: "",
        images: { create: [1, 0].map((position) => ({ contentType: "image/png", position, data: png })) },
      } } },
      include: { entries: { include: { images: { orderBy: { position: "asc" } } } } },
    });
    ideaId = idea.id;
    const images = idea.entries[0].images;
    assert.deepEqual(images.map((image) => image.position), [0, 1]);
    for (const image of images) assert.deepEqual(image.data, new Uint8Array(png));
    const summary = await prisma.idea.findUniqueOrThrow({ where: { id: idea.id }, select: ideaFeedSelect });
    assert.deepEqual(summary.entries[0].images, [{ id: images[0].id }]);
    assert.equal(summary.entries[0].content, "");
    const imageWhere = { id: images[0].id, entry: { idea: activeIdeaWhere } };
    await prisma.idea.update({ where: { id: idea.id }, data: { archivedAt: new Date() } });
    assert.ok(await prisma.ideaEntryImage.findFirst({ where: imageWhere }));
    await prisma.idea.update({ where: { id: idea.id }, data: { deletedAt: new Date() } });
    assert.equal(await prisma.ideaEntryImage.findFirst({ where: imageWhere }), null);
    assert.equal(await prisma.ideaEntryImage.count({ where: { entryId: idea.entries[0].id } }), 2);
    await prisma.idea.delete({ where: { id: idea.id } });
    assert.equal(await prisma.ideaEntryImage.count({ where: { entryId: idea.entries[0].id } }), 0);
  } finally {
    if (ideaId) await prisma.idea.deleteMany({ where: { id: ideaId } });
  }
});
