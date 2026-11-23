import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { breakOutEntry } from "../apps/bolts/src/app/actions";
import { EntryCard } from "../apps/bolts/src/components/entry-card";
import { EntryText } from "../apps/bolts/src/components/entry-text";
import { IdeaLinks } from "../apps/bolts/src/components/idea-views";
import { IdeaList } from "../apps/bolts/src/components/idea-list";
import { entryBoltTitle } from "../apps/bolts/src/lib/entry-breakout";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../apps/bolts/src/lib/auth";
import { getPrisma } from "../apps/bolts/src/lib/prisma";
import { Prisma } from "../apps/bolts/src/generated/prisma/client";

const ideaId = "cmivnlm9w0000356l5ih14d7z";
const entryId = "cmivnlm9w0001356l5ih14d7z";
const newIdeaId = "cmivnlm9w0002356l5ih14d7z";
const createdAt = new Date("2026-11-01T12:00:00Z");
const entry = { id: entryId, content: "A thought\nMore detail", linkedIdeaId: null, isTodo: false, completedAt: null, createdAt, images: [] };

async function setup(t: TestContext, authenticated = true) {
  for (const [key, value] of Object.entries({
    BOLTS_DATABASE_URL: "postgresql://localhost:1/bolts_breakout_test",
    BOLTS_COOKIE_SECRET: "test-only-bolts-breakout-secret",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const headers = new Headers({ origin: "http://localhost:3002" });
  if (authenticated) headers.set("cookie", `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}`);
  t.mock.method(nextHeaders, "cookies", async () => RequestCookiesAdapter.seal(new RequestCookies(headers)));
  t.mock.method(nextHeaders, "headers", async () => headers);
  const revalidate = t.mock.method(nextCache, "revalidatePath", () => {});
  const prisma = getPrisma();
  const transaction = t.mock.fn<(callback: (tx: Prisma.TransactionClient) => Promise<string>) => Promise<string>>(async (callback) => callback(prisma));
  const create = t.mock.fn<(_args: Prisma.IdeaCreateArgs) => Promise<{ id: string }>>(async () => ({ id: newIdeaId }));
  const move = t.mock.fn<(_args: Prisma.IdeaEntryUpdateArgs) => Promise<{ createdAt: Date; content: string }>>(async () => ({ createdAt, content: entry.content }));
  const link = t.mock.fn<(_args: Prisma.IdeaEntryCreateArgs) => Promise<{ id: string }>>(async () => ({ id: "link" }));
  for (const [delegate, key, value] of [
    [prisma, "$transaction", transaction],
    [prisma.idea, "create", create],
    [prisma.ideaEntry, "update", move],
    [prisma.ideaEntry, "create", link],
  ] as const) {
    const original = Reflect.get(delegate, key);
    Object.defineProperty(delegate, key, { value, configurable: true, writable: true });
    t.after(() => Object.defineProperty(delegate, key, { value: original, configurable: true, writable: true }));
  }
  return { transaction, create, move, link, revalidate };
}

function data(title = "New bolt") {
  const form = new FormData();
  form.set("title", title);
  return form;
}

test("breakout titles use the first line and stay within the title limit", () => {
  assert.equal(entryBoltTitle("  First line\r\nSecond line "), "First line");
  assert.equal(entryBoltTitle(""), "");
  assert.equal(entryBoltTitle("a".repeat(201)).length, 200);
});

test("breakout atomically moves the existing entry, leaves a dated link and opens the new bolt", async (t) => {
  const { transaction, create, move, link, revalidate } = await setup(t);
  await assert.rejects(() => breakOutEntry(ideaId, entryId, {}, data(" New bolt ")), /NEXT_REDIRECT/);
  assert.equal(transaction.mock.callCount(), 1);
  const bolt = create.mock.calls[0].arguments[0].data;
  assert.equal(bolt.title, "New bolt");
  assert.equal(bolt.pendingDismissal, true);
  assert.ok(bolt.dueAt instanceof Date);
  assert.deepEqual(move.mock.calls[0].arguments[0], {
    where: { id: entryId, ideaId, linkedIdeaId: null, idea: { deletedAt: null } },
    data: { ideaId: newIdeaId }, select: { createdAt: true, content: true },
  });
  assert.deepEqual(link.mock.calls[0].arguments[0].data, {
    ideaId, content: entry.content, createdAt, linkedIdeaId: newIdeaId,
  });
  assert.deepEqual(revalidate.mock.calls.map((call) => call.arguments[0]), [
    "/bolts/", "/bolts/search", `/bolts/ideas/${ideaId}`,
  ]);
});

test("invalid or unauthenticated breakouts never touch the database", async (t) => {
  const { transaction } = await setup(t, false);
  await assert.rejects(() => breakOutEntry(ideaId, entryId, {}, data()), /NEXT_REDIRECT/);
  assert.equal(transaction.mock.callCount(), 0);
});

test("breakouts accept blank, whitespace-only and omitted optional titles", async (t) => {
  const { create, link } = await setup(t);
  for (const form of [data(""), data("   "), new FormData()]) {
    await assert.rejects(() => breakOutEntry(ideaId, entryId, {}, form), /NEXT_REDIRECT/);
  }
  assert.deepEqual(create.mock.calls.map((call) => call.arguments[0].data.title), ["", "", ""]);
  assert.deepEqual(link.mock.calls.map((call) => call.arguments[0].data.content), [
    entry.content, entry.content, entry.content,
  ]);
});

test("image-only breakouts keep blank original text and still render a bolt navigation target", async (t) => {
  const { move, link } = await setup(t);
  move.mock.mockImplementation(async () => ({ createdAt, content: "" }));
  await assert.rejects(() => breakOutEntry(ideaId, entryId, {}, data("")), /NEXT_REDIRECT/);
  assert.equal(link.mock.calls[0].arguments[0].data.content, "");
  const document = parseDocument(renderToStaticMarkup(createElement(EntryCard, {
    ideaId, entry: { ...entry, content: "", linkedIdeaId: newIdeaId },
  })));
  const target = DomUtils.findOne((node) => node.name === "a" && node.attribs.href === `/ideas/${newIdeaId}`, document.children);
  assert.ok(target);
  assert.equal(target.attribs.title, "Double-tap to open bolt");
});

test("invalid IDs and oversized titles are shown before starting a transaction", async (t) => {
  const { transaction } = await setup(t);
  for (const [bolt, item, title] of [
    ["invalid", entryId, ""], [ideaId, "invalid", ""], [ideaId, entryId, "a".repeat(201)],
  ]) {
    assert.ok((await breakOutEntry(bolt, item, {}, data(title))).error);
  }
  assert.equal(transaction.mock.callCount(), 0);
});

test("stale entries and transaction failures are logged, surfaced and never revalidated", async (t) => {
  const { move, link, revalidate } = await setup(t);
  const log = t.mock.method(console, "error", () => {});
  move.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("Entry moved", { code: "P2025", clientVersion: "test" });
  });
  assert.match((await breakOutEntry(ideaId, entryId, {}, data())).error!, /already a bolt link/);
  assert.equal(link.mock.callCount(), 0);
  move.mock.mockImplementation(async () => ({ createdAt, content: entry.content }));
  link.mock.mockImplementation(async () => { throw new Error("test insert failed"); });
  assert.match((await breakOutEntry(ideaId, entryId, {}, data())).error!, /Nothing was moved/);
  assert.equal(log.mock.callCount(), 2);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("entry options offer edit and breakout; bolt links cannot be broken out again", () => {
  for (const linkedIdeaId of [null, newIdeaId]) {
    const document = parseDocument(renderToStaticMarkup(createElement(EntryCard, { ideaId, entry: { ...entry, linkedIdeaId } })));
    const summary = DomUtils.findOne((node) => node.name === "summary", document.children);
    assert.equal(summary?.attribs["aria-label"], "Entry options");
    const buttons = DomUtils.findAll((node) => node.name === "button", document.children);
    assert.deepEqual(buttons.map((button) => DomUtils.textContent(button).trim()), linkedIdeaId ? ["Edit entry"] : ["Edit entry", "Break out"]);
  }
});

test("bolt links show lightning and internal navigation in entries, Links and feed previews", () => {
  const linked = { ...entry, linkedIdeaId: newIdeaId };
  const elements = [
    createElement(EntryText, { text: linked.content, linkedIdeaId: newIdeaId }),
    createElement(IdeaLinks, { entries: [linked] }),
    createElement(IdeaList, {
      page: { ideas: [{ id: ideaId, title: "Parent", dueAt: createdAt, createdAt, snoozeCount: 0, archivedAt: null, _count: { entries: 1 }, entries: [linked] }], nextCursor: null },
      request: { kind: "due", asOf: createdAt.toISOString(), cursor: null },
    }),
  ];
  for (const element of elements) {
    const document = parseDocument(renderToStaticMarkup(element));
    const link = DomUtils.findOne((node) => node.name === "a" && node.attribs.href === `/ideas/${newIdeaId}`, document.children);
    assert.ok(link);
    assert.match(DomUtils.textContent(link), /\u26a1/);
    assert.match(DomUtils.textContent(link), /A thought\nMore detail/);
    assert.equal(link.attribs.target, undefined);
    assert.equal(DomUtils.findAll((node) => node.name === "a", link.children).length, 0);
  }
});

test("linked entry text keeps its original text and advertises double-tap navigation without changing web links", () => {
  const document = parseDocument(renderToStaticMarkup(createElement(EntryText, { text: entry.content, linkedIdeaId: newIdeaId })));
  const link = DomUtils.findOne((node) => node.name === "a", document.children);
  assert.ok(link);
  assert.equal(link.attribs.title, "Double-tap to open bolt");
  assert.ok(link.attribs.class.split(" ").includes("entry-bolt-link"));
  assert.equal(DomUtils.textContent(link), `\u26a1 ${entry.content}`);
  const external = parseDocument(renderToStaticMarkup(createElement(EntryText, { text: "https://example.com" })));
  const webLink = DomUtils.findOne((node) => node.name === "a", external.children);
  assert.equal(webLink?.attribs.class, "entry-link");
  assert.equal(webLink?.attribs.target, "_blank");
});
