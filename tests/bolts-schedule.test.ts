import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { londonDayAfter, snoozeDays } from "../apps/bolts/src/lib/idea-schedule";
import { getIdeaPage, ideaPageArgs, ideaPageRequestSchema, searchQuerySchema, type IdeaPageRequest } from "../apps/bolts/src/lib/idea-feed";
import { IdeaList } from "../apps/bolts/src/components/idea-list";
import { IdeaDetail } from "../apps/bolts/src/components/idea-detail";
import SearchPage from "../apps/bolts/src/app/search/page";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../apps/bolts/src/lib/auth";
import { getPrisma } from "../apps/bolts/src/lib/prisma";
import type { Idea, Prisma } from "../apps/bolts/src/generated/prisma/client";
import type { IdeaSummary } from "../apps/bolts/src/lib/ideas";
import { addEntry, archiveIdea, createIdea, dismissIdea, loadIdeaPage, reactivateIdea, snoozeIdea } from "../apps/bolts/src/app/actions";

const ideaId = "cmivnlm9w0000356l5ih14d7z";
const dueRequest: IdeaPageRequest = { kind: "due", asOf: "2026-11-19T12:00:00.000Z", cursor: null };
const record = {
  id: ideaId, title: "A thought", createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"), deletedAt: null, archivedAt: null,
  dueAt: new Date("2026-01-01T00:00:00Z"), snoozeCount: 0, pendingDismissal: true,
};

test("snooze sequence expands to 60 days and stays capped", () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => snoozeDays(i)), [1, 3, 7, 14, 30, 60, 60, 60, 60]);
  for (const invalid of [-1, 0.5, NaN, Infinity]) assert.throws(() => snoozeDays(invalid));
});

test("calendar scheduling uses London midnight across DST, year and month boundaries", () => {
  const examples = [
    ["2026-11-19T23:59:59Z", 1, "2026-11-20T00:00:00.000Z"],
    ["2026-06-01T23:30:00Z", 1, "2026-06-02T23:00:00.000Z"],
    ["2026-03-28T12:00:00Z", 1, "2026-03-29T00:00:00.000Z"],
    ["2026-03-29T12:00:00Z", 1, "2026-03-29T23:00:00.000Z"],
    ["2026-10-24T12:00:00Z", 1, "2026-10-24T23:00:00.000Z"],
    ["2026-10-25T12:00:00Z", 1, "2026-10-26T00:00:00.000Z"],
    ["2026-12-31T12:00:00Z", 1, "2027-01-01T00:00:00.000Z"],
    ["2028-02-28T12:00:00Z", 1, "2028-02-29T00:00:00.000Z"],
    ["2026-03-01T12:00:00Z", 30, "2026-03-30T23:00:00.000Z"],
    ["2026-09-01T12:00:00Z", 60, "2026-10-31T00:00:00.000Z"],
  ] as const;
  for (const [now, days, expected] of examples) {
    assert.equal(londonDayAfter(new Date(now), days).toISOString(), expected);
  }
  assert.throws(() => londonDayAfter(new Date("invalid"), 1));
  assert.throws(() => londonDayAfter(new Date(), 0));
});

test("due query has a fixed cutoff and lexicographic timestamp/ID cursor, not an offset", () => {
  const cursor = { dueAt: "2026-11-18T00:00:00.000Z", createdAt: "2026-11-01T00:00:00.000Z", id: ideaId };
  const args = ideaPageArgs({ ...dueRequest, cursor });
  assert.equal(args.take, 11);
  assert.deepEqual(args.orderBy, [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
  assert.deepEqual(args.where.AND, [
    { deletedAt: null },
    { archivedAt: null, dueAt: { lte: new Date(dueRequest.asOf) } },
    { OR: [
      { dueAt: { gt: new Date(cursor.dueAt) } },
      { dueAt: new Date(cursor.dueAt), createdAt: { gt: new Date(cursor.createdAt) } },
      { dueAt: new Date(cursor.dueAt), createdAt: new Date(cursor.createdAt), id: { gt: ideaId } },
    ] },
  ]);
});

test("search matches literal titles and any entry, includes future bolts, and excludes deletions", () => {
  const args = ideaPageArgs({ kind: "search", query: "50%_\\", cursor: null });
  assert.deepEqual(args.where.AND, [
    { deletedAt: null },
    { OR: [
      { title: { contains: "50\\%\\_\\\\", mode: "insensitive" } },
      { entries: { some: { content: { contains: "50\\%\\_\\\\", mode: "insensitive" } } } },
    ] },
  ]);
  assert.equal(searchQuerySchema.parse("  some words  "), "some words");
  assert.equal(searchQuerySchema.safeParse("x".repeat(201)).success, false);
  assert.equal(ideaPageRequestSchema.safeParse({ kind: "search", query: " ", cursor: null }).success, false);
  assert.equal(ideaPageRequestSchema.safeParse({ ...dueRequest, asOf: "not a date" }).success, false);
  assert.equal(ideaPageRequestSchema.safeParse({ ...dueRequest, cursor: { id: ideaId } }).success, false);
});

async function setup(t: TestContext, authenticated = true) {
  for (const [key, value] of Object.entries({
    BOLTS_DATABASE_URL: "postgresql://localhost:1/bolts_schedule_test",
    BOLTS_COOKIE_SECRET: "test-only-bolts-schedule-secret",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const headers = new Headers({ origin: "http://localhost:3001" });
  if (authenticated) headers.set("cookie", `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}`);
  t.mock.method(nextHeaders, "cookies", async () => RequestCookiesAdapter.seal(new RequestCookies(headers)));
  t.mock.method(nextHeaders, "headers", async () => headers);
  const revalidate = t.mock.method(nextCache, "revalidatePath", () => {});
  const prisma = getPrisma();
  const findUnique = t.mock.fn<(_args: Prisma.IdeaFindUniqueArgs) => Promise<Idea | null>>(async () => ({ ...record }));
  const findMany = t.mock.fn<(_args: Prisma.IdeaFindManyArgs) => Promise<IdeaSummary[]>>(async () => Array.from({ length: 11 }, (_, i) => ({
    ...record, id: `${ideaId}${i}`, _count: { entries: 0 }, entries: [],
  })));
  const updateMany = t.mock.fn<(_args: Prisma.IdeaUpdateManyArgs) => Promise<{ count: number }>>(async () => ({ count: 1 }));
  const update = t.mock.fn<(_args: Prisma.IdeaUpdateArgs) => Promise<Idea>>(async () => ({ ...record }));
  const create = t.mock.fn<(_args: Prisma.IdeaCreateArgs) => Promise<Idea>>(async () => ({ ...record }));
  for (const [key, value] of Object.entries({ findUnique, findMany, updateMany, update, create })) {
    const original = Reflect.get(prisma.idea, key);
    Object.defineProperty(prisma.idea, key, { value, configurable: true, writable: true });
    t.after(() => Object.defineProperty(prisma.idea, key, { value: original, configurable: true, writable: true }));
  }
  return { findUnique, findMany, updateMany, update, create, revalidate };
}

test("pagination returns exactly ten items and a cursor for the last returned item", async (t) => {
  const { findMany } = await setup(t);
  const first = await getIdeaPage(dueRequest);
  assert.equal(first.ideas.length, 10);
  assert.equal(first.nextCursor?.id, `${ideaId}9`);
  assert.equal(first.nextCursor?.dueAt, record.dueAt.toISOString());
  findMany.mock.mockImplementation(async () => []);
  assert.deepEqual(await getIdeaPage({ ...dueRequest, cursor: first.nextCursor }), { ideas: [], nextCursor: null });
});

test("scheduling and pagination actions authenticate before touching the database", async (t) => {
  const { findUnique, findMany, updateMany } = await setup(t, false);
  await assert.rejects(() => snoozeIdea(ideaId, record.dueAt.toISOString()), /NEXT_REDIRECT/);
  await assert.rejects(() => dismissIdea(ideaId), /NEXT_REDIRECT/);
  await assert.rejects(() => loadIdeaPage(dueRequest), /NEXT_REDIRECT/);
  await assert.rejects(() => archiveIdea(ideaId), /NEXT_REDIRECT/);
  await assert.rejects(() => reactivateIdea(ideaId), /NEXT_REDIRECT/);
  assert.equal(findUnique.mock.callCount(), 0);
  assert.equal(findMany.mock.callCount(), 0);
  assert.equal(updateMany.mock.callCount(), 0);
});

test("snoozes persist every step from today and cap the counter", async (t) => {
  const { findUnique, updateMany, revalidate } = await setup(t);
  for (let count = 0; count <= 7; count++) {
    findUnique.mock.mockImplementation(async () => ({ ...record, snoozeCount: count }));
    assert.deepEqual(await snoozeIdea(ideaId, record.dueAt.toISOString()), { saved: true });
    const args = updateMany.mock.calls.at(-1)!.arguments[0];
    assert.deepEqual(args.data, {
      dueAt: londonDayAfter(new Date(), snoozeDays(count)),
      snoozeCount: Math.min(count + 1, 5),
      pendingDismissal: false,
    });
    assert.ok(args.where);
    assert.equal(args.where.deletedAt, null);
    assert.equal(args.where.snoozeCount, count);
    assert.equal(args.where.updatedAt, record.updatedAt);
  }
  assert.deepEqual(revalidate.mock.calls.slice(0, 3).map((call) => call.arguments[0]), [
    "/bolts/", "/bolts/search", `/bolts/ideas/${ideaId}`,
  ]);
});

test("dismissal schedules tomorrow, resets snoozes, and returns to the due feed", async (t) => {
  const { findUnique, updateMany } = await setup(t);
  findUnique.mock.mockImplementation(async () => ({ ...record, snoozeCount: 4 }));
  await assert.rejects(() => dismissIdea(ideaId), /NEXT_REDIRECT/);
  assert.deepEqual(updateMany.mock.calls[0].arguments[0].data, {
    dueAt: londonDayAfter(new Date(), 1), snoozeCount: 0, pendingDismissal: false,
  });
});

test("invalid, deleted, stale and uncontributed bolts cannot be rescheduled", async (t) => {
  const { findUnique, updateMany } = await setup(t);
  assert.ok((await snoozeIdea("invalid", "")).error);
  assert.equal(findUnique.mock.callCount(), 0);
  assert.ok((await snoozeIdea(ideaId, "stale")).error);
  findUnique.mock.mockImplementation(async () => ({ ...record, pendingDismissal: false }));
  assert.ok((await dismissIdea(ideaId)).error);
  findUnique.mock.mockImplementation(async () => null);
  assert.ok((await snoozeIdea(ideaId, record.dueAt.toISOString())).error);
  assert.equal(updateMany.mock.callCount(), 0);
});

test("concurrent reschedules and database failures are surfaced without success", async (t) => {
  const { updateMany, revalidate, findUnique } = await setup(t);
  updateMany.mock.mockImplementation(async () => ({ count: 0 }));
  assert.match((await snoozeIdea(ideaId, record.dueAt.toISOString())).error!, /changed/);
  assert.equal(revalidate.mock.callCount(), 0);
  findUnique.mock.mockImplementation(async () => { throw new Error("test database unavailable"); });
  const log = t.mock.method(console, "error", () => {});
  assert.match((await dismissIdea(ideaId)).error!, /could not be saved/);
  assert.equal(log.mock.callCount(), 1);
});

test("contribution enables dismissal but does not silently change the due time", async (t) => {
  const { update } = await setup(t);
  const data = new FormData();
  data.set("content", "Something to develop");
  assert.deepEqual(await addEntry(ideaId, {}, data), { saved: true });
  const args = update.mock.calls[0].arguments[0];
  assert.equal(args.data.pendingDismissal, true);
  assert.equal("dueAt" in args.data, false);
  assert.equal("snoozeCount" in args.data, false);
});

test("new bolts are scheduled for the next London day", async (t) => {
  const { create } = await setup(t);
  const data = new FormData();
  data.set("title", "A fresh idea");
  await assert.rejects(() => createIdea({}, data), /NEXT_REDIRECT/);
  const dueAt = create.mock.calls[0].arguments[0].data.dueAt;
  assert.ok(dueAt instanceof Date);
  assert.equal(dueAt.toISOString(), londonDayAfter(new Date(), 1).toISOString());
});

test("feed shows snooze duration, separate search navigation, and pagination fallback", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, {
    page: {
      ideas: [{ ...record, snoozeCount: 2, _count: { entries: 0 }, entries: [] }],
      nextCursor: { id: ideaId, dueAt: record.dueAt.toISOString(), createdAt: record.createdAt.toISOString() },
    },
    request: dueRequest,
  }));
  assert.match(html, /Snooze A thought for 7 days/);
  assert.match(html, /aria-label="Archive A thought"/);
  assert.match(html, /aria-label="Actions for A thought"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, new RegExp(`aria-controls="bolt-actions-${ideaId}"`));
  assert.match(html, new RegExp(`id="bolt-actions-${ideaId}"`));
  assert.doesNotMatch(html, /card-arrow/);
  assert.match(html, /href="\/search"/);
  assert.match(html, /Load more/);
  assert.doesNotMatch(html, /All bolts/);
});

test("done-for-now is available for saved contributions, not an untouched bolt", () => {
  for (const pendingDismissal of [false, true]) {
    const html = renderToStaticMarkup(createElement(IdeaDetail, { idea: { ...record, pendingDismissal, entries: [] } }));
    assert.equal(html.includes("Done for now"), pendingDismissal);
    assert.doesNotMatch(html, /Ready to let this thought rest|midnight London time/);
    if (pendingDismissal) {
      const document = parseDocument(html);
      const done = DomUtils.findOne((node) => node.name === "button" && DomUtils.textContent(node) === "Done for now", document.children);
      const add = DomUtils.findOne((node) => node.name === "button" && DomUtils.textContent(node) === "Add entry", document.children);
      assert.ok(done);
      assert.ok(add);
      assert.equal(done.parent, add.parent);
      assert.equal(done.attribs.formnovalidate, "");
      assert.equal(done.parent?.type, "tag");
    }
  }
});

test("archive preserves the schedule and entries while removing pending dismissal", async (t) => {
  const { updateMany, revalidate } = await setup(t);
  assert.deepEqual(await archiveIdea(ideaId), { saved: true });
  const args = updateMany.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: ideaId, deletedAt: null, archivedAt: null });
  assert.ok(args.data.archivedAt instanceof Date);
  assert.equal(args.data.pendingDismissal, false);
  assert.deepEqual(Object.keys(args.data).sort(), ["archivedAt", "pendingDismissal"]);
  assert.deepEqual(revalidate.mock.calls.map((call) => call.arguments[0]), [
    "/bolts/", "/bolts/search", `/bolts/ideas/${ideaId}`,
  ]);
});

test("reactivating makes an archived bolt immediately due with a fresh snooze sequence", async (t) => {
  const { updateMany } = await setup(t);
  const before = Date.now();
  assert.deepEqual(await reactivateIdea(ideaId), { saved: true });
  const args = updateMany.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: ideaId, deletedAt: null, archivedAt: { not: null } });
  assert.ok(args.data.dueAt instanceof Date);
  assert.ok(args.data.dueAt.getTime() >= before && args.data.dueAt.getTime() <= Date.now());
  assert.deepEqual({ ...args.data, dueAt: undefined }, {
    archivedAt: null, dueAt: undefined, snoozeCount: 0, pendingDismissal: false,
  });
});

test("archive and reactivation reject invalid, deleted or already changed records", async (t) => {
  const { updateMany, revalidate } = await setup(t);
  assert.ok((await archiveIdea("invalid")).error);
  assert.ok((await reactivateIdea("../invalid")).error);
  assert.equal(updateMany.mock.callCount(), 0);
  updateMany.mock.mockImplementation(async () => ({ count: 0 }));
  assert.ok((await archiveIdea(ideaId)).error);
  assert.ok((await reactivateIdea(ideaId)).error);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("archive and reactivation failures are logged and surfaced without success", async (t) => {
  const { updateMany, revalidate } = await setup(t);
  updateMany.mock.mockImplementation(async () => { throw new Error("test archive database failure"); });
  const log = t.mock.method(console, "error", () => {});
  assert.match((await archiveIdea(ideaId)).error!, /could not be archived/);
  assert.match((await reactivateIdea(ideaId)).error!, /could not be reactivated/);
  assert.equal(log.mock.callCount(), 2);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("archived bolts cannot be snoozed or dismissed by a stale feed", async (t) => {
  const { findUnique, updateMany } = await setup(t);
  findUnique.mock.mockImplementation(async () => ({ ...record, archivedAt: new Date() }));
  assert.match((await snoozeIdea(ideaId, record.dueAt.toISOString())).error!, /archived/);
  assert.match((await dismissIdea(ideaId)).error!, /archived/);
  assert.equal(updateMany.mock.callCount(), 0);
});

test("archived details offer reactivation rather than done-for-now", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: { ...record, archivedAt: new Date(), entries: [] },
  }));
  assert.match(html, /Archived/);
  assert.match(html, /Reactivate/);
  assert.match(html, /Add entry/);
  assert.doesNotMatch(html, /Done for now/);
});

test("search page prompts before searching and uses a base-path-aware GET form", async () => {
  const html = renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({}) }));
  assert.match(html, /action="\/bolts\/search\/"/);
  assert.match(html, /method="get"/);
  assert.match(html, /name="q"/);
  assert.doesNotMatch(html, /class="idea-card"/);
});

test("invalid pagination requests and database read failures display errors", async (t) => {
  const { findMany } = await setup(t);
  assert.ok((await loadIdeaPage({ ...dueRequest, asOf: "bad" })).error);
  assert.equal(findMany.mock.callCount(), 0);
  findMany.mock.mockImplementation(async () => { throw new Error("test read failure"); });
  const log = t.mock.method(console, "error", () => {});
  assert.ok((await loadIdeaPage(dueRequest)).error);
  assert.equal(log.mock.callCount(), 1);
});
