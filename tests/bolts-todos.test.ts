import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { addEntry, createIdea, setEntryCompleted, updateEntry } from "../apps/bolts/src/app/actions";
import { parseEntryContent } from "../apps/bolts/src/lib/entry-todos";
import { entrySchema, type IdeaDetail as IdeaDetailData } from "../apps/bolts/src/lib/ideas";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../apps/bolts/src/lib/auth";
import { getPrisma } from "../apps/bolts/src/lib/prisma";
import { Prisma, type Idea } from "../apps/bolts/src/generated/prisma/client";
import { IdeaDetail } from "../apps/bolts/src/components/idea-detail";
import { IdeaLinks, IdeaTodos } from "../apps/bolts/src/components/idea-views";
import { IdeaList } from "../apps/bolts/src/components/idea-list";

const ideaId = "cmivnlm9w0000356l5ih14d7z";
const entryId = "cmivnlm9w0001356l5ih14d7z";
const imageId = "cmivnlm9w0002356l5ih14d7z";
const secondImageId = "cmivnlm9w0003356l5ih14d7z";
const idea = {
  id: ideaId, title: "", createdAt: new Date("2026-11-22T10:00:00Z"),
  updatedAt: new Date("2026-11-22T10:00:00Z"), deletedAt: null, archivedAt: null,
  dueAt: new Date("2026-11-23T00:00:00Z"), snoozeCount: 0, pendingDismissal: true,
};
const entry: IdeaDetailData["entries"][number] = {
  id: entryId, content: "Read https://example.com/article", linkedIdeaId: null, isTodo: true,
  completedAt: null, createdAt: idea.createdAt, images: [],
};

async function setup(t: TestContext, authenticated = true) {
  for (const [key, value] of Object.entries({
    BOLTS_DATABASE_URL: "postgresql://localhost:1/bolts_todos_test",
    BOLTS_COOKIE_SECRET: "test-only-bolts-todos-secret",
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
  const update = t.mock.fn<(_args: Prisma.IdeaUpdateArgs) => Promise<Idea>>(async () => ({ ...idea }));
  const create = t.mock.fn<(_args: Prisma.IdeaCreateArgs) => Promise<Idea>>(async () => ({ ...idea }));
  const updateMany = t.mock.fn<(_args: Prisma.IdeaEntryUpdateManyArgs) => Promise<{ count: number }>>(async () => ({ count: 1 }));
  const findFirst = t.mock.fn<(_args: Prisma.IdeaEntryFindFirstArgs) => Promise<{ images: { id: string }[] } | null>>(async () => ({ images: [] }));
  const entryUpdate = t.mock.fn<(_args: Prisma.IdeaEntryUpdateArgs) => Promise<{ id: string }>>(async () => ({ id: entryId }));
  for (const [delegate, key, value] of [
    [prisma.idea, "update", update],
    [prisma.idea, "create", create],
    [prisma.ideaEntry, "updateMany", updateMany],
    [prisma.ideaEntry, "findFirst", findFirst],
    [prisma.ideaEntry, "update", entryUpdate],
  ] as const) {
    const original = Reflect.get(delegate, key);
    Object.defineProperty(delegate, key, { value, configurable: true, writable: true });
    t.after(() => Object.defineProperty(delegate, key, { value: original, configurable: true, writable: true }));
  }
  return { update, create, updateMany, findFirst, entryUpdate, revalidate };
}

function completionData(completed: string) {
  const data = new FormData();
  data.set("completed", completed);
  return data;
}

test("a leading [] makes the entire entry a to-do and strips only the leading marker", () => {
  assert.deepEqual(parseEntryContent("  [] Read this\nand [] keep this marker  "), {
    content: "Read this\nand [] keep this marker", isTodo: true,
  });
  assert.deepEqual(parseEntryContent("[]Read this"), { content: "Read this", isTodo: true });
  for (const content of ["A note [] with a marker", "[ ] A note", "[x] A note", "A note\n[] not a task"]) {
    assert.deepEqual(parseEntryContent(content), { content, isTodo: false });
  }
  assert.equal(entrySchema.safeParse({ ideaId, content: " [] \n " }).success, false);
  assert.equal(entrySchema.safeParse({ ideaId, content: "[]", imageCount: 1 }).success, true);
  assert.equal(entrySchema.safeParse({ ideaId, content: "[]" + "a".repeat(19998) }).success, true);
  assert.equal(entrySchema.safeParse({ ideaId, content: "[]" + "a".repeat(19999) }).success, false);
});

test("new bolts and existing bolts persist to-do type and content without the marker", async (t) => {
  const { update, create } = await setup(t);
  const data = new FormData();
  data.set("content", " [] Read https://example.com/article\nTake notes ");
  assert.deepEqual(await addEntry(ideaId, {}, data), { saved: true });
  assert.deepEqual(update.mock.calls[0].arguments[0].data.entries, {
    create: { content: "Read https://example.com/article\nTake notes", isTodo: true },
  });
  await assert.rejects(() => createIdea({}, data), /NEXT_REDIRECT/);
  assert.deepEqual(create.mock.calls[0].arguments[0].data.entries, update.mock.calls[0].arguments[0].data.entries);
  data.set("content", "[]");
  assert.ok((await addEntry(ideaId, {}, data)).error);
  assert.equal(update.mock.callCount(), 1);
});

test("completion and reopening update only the requested to-do, leaving its bolt's schedule unchanged", async (t) => {
  const { updateMany, update, revalidate } = await setup(t);
  assert.deepEqual(await setEntryCompleted(ideaId, entryId, {}, completionData("true")), { saved: true });
  const args = updateMany.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: entryId, ideaId, isTodo: true, idea: { deletedAt: null } });
  assert.ok(args.data.completedAt instanceof Date);
  assert.deepEqual(Object.keys(args.data), ["completedAt"]);
  assert.deepEqual(await setEntryCompleted(ideaId, entryId, {}, completionData("false")), { saved: true });
  assert.deepEqual(updateMany.mock.calls[1].arguments[0].data, { completedAt: null });
  assert.equal(update.mock.callCount(), 0);
  assert.deepEqual(revalidate.mock.calls.slice(0, 3).map((call) => call.arguments[0]), [
    "/bolts/", "/bolts/search", `/bolts/ideas/${ideaId}`,
  ]);
});

test("invalid completion requests, deleted entries and notes cannot report successful completion", async (t) => {
  const { updateMany, revalidate } = await setup(t);
  for (const [id, entry, completed] of [["invalid", entryId, "true"], [ideaId, "invalid", "true"], [ideaId, entryId, "yes"]]) {
    assert.ok((await setEntryCompleted(id, entry, {}, completionData(completed))).error);
  }
  assert.equal(updateMany.mock.callCount(), 0);
  updateMany.mock.mockImplementation(async () => ({ count: 0 }));
  assert.match((await setEntryCompleted(ideaId, entryId, {}, completionData("true"))).error!, /no longer exists/);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("database failures are logged and shown rather than silently completing a task", async (t) => {
  const { updateMany, revalidate } = await setup(t);
  updateMany.mock.mockImplementation(async () => { throw new Error("test database unavailable"); });
  const log = t.mock.method(console, "error", () => {});
  assert.match((await setEntryCompleted(ideaId, entryId, {}, completionData("true"))).error!, /could not be updated/);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("to-do writes require a session before accessing the database", async (t) => {
  const { updateMany, update, create, findFirst, entryUpdate } = await setup(t, false);
  await assert.rejects(() => setEntryCompleted(ideaId, entryId, {}, completionData("true")), /NEXT_REDIRECT/);
  const data = new FormData();
  data.set("content", "[] Task");
  await assert.rejects(() => addEntry(ideaId, {}, data), /NEXT_REDIRECT/);
  await assert.rejects(() => createIdea({}, data), /NEXT_REDIRECT/);
  await assert.rejects(() => updateEntry(ideaId, entryId, {}, data), /NEXT_REDIRECT/);
  assert.equal(updateMany.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(findFirst.mock.callCount(), 0);
  assert.equal(entryUpdate.mock.callCount(), 0);
});

test("editing a to-do preserves completion, attachments and original dates without rescheduling", async (t) => {
  const { findFirst, entryUpdate, update, revalidate } = await setup(t);
  findFirst.mock.mockImplementation(async () => ({ images: [{ id: imageId }, { id: secondImageId }] }));
  const data = new FormData();
  data.set("content", " [] Revised task https://example.org\nSecond line ");
  assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
  const args = entryUpdate.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: entryId, ideaId, idea: { deletedAt: null } });
  assert.deepEqual(args.data, { content: "Revised task https://example.org\nSecond line", isTodo: true });
  assert.equal(update.mock.callCount(), 0);
  assert.deepEqual(revalidate.mock.calls.map((call) => call.arguments[0]), [
    "/bolts/", "/bolts/search", `/bolts/ideas/${ideaId}`,
  ]);
});

test("editing can convert between notes and to-dos, clearing completion only when becoming a note", async (t) => {
  const { entryUpdate } = await setup(t);
  const data = new FormData();
  for (const content of ["[] A task", "A plain note"]) {
    data.set("content", content);
    assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
  }
  assert.deepEqual(entryUpdate.mock.calls[0].arguments[0].data, { content: "A task", isTodo: true });
  assert.deepEqual(entryUpdate.mock.calls[1].arguments[0].data, { content: "A plain note", isTodo: false, completedAt: null });
});

test("edit validation uses saved images, rejects blank text-only entries and enforces size limits", async (t) => {
  const { findFirst, entryUpdate } = await setup(t);
  const data = new FormData();
  for (const content of [" ", " [] ", "a".repeat(20001)]) {
    data.set("content", content);
    assert.ok((await updateEntry(ideaId, entryId, {}, data)).error);
  }
  assert.equal(entryUpdate.mock.callCount(), 0);
  findFirst.mock.mockImplementation(async () => ({ images: [{ id: imageId }] }));
  data.set("content", "[]");
  assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
  assert.deepEqual(entryUpdate.mock.calls[0].arguments[0].data, { content: "", isTodo: true });
  data.set("content", "a".repeat(20000));
  assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
});

test("invalid IDs, deleted entries, stale saves and database failures cannot report successful edits", async (t) => {
  const { findFirst, entryUpdate, revalidate } = await setup(t);
  const data = new FormData();
  data.set("content", "Updated note");
  for (const [id, entry] of [["invalid", entryId], [ideaId, "invalid"]]) {
    assert.ok((await updateEntry(id, entry, {}, data)).error);
  }
  assert.equal(findFirst.mock.callCount(), 0);
  findFirst.mock.mockImplementation(async () => null);
  assert.match((await updateEntry(ideaId, entryId, {}, data)).error!, /no longer exists/);
  assert.equal(entryUpdate.mock.callCount(), 0);
  findFirst.mock.mockImplementation(async () => ({ images: [] }));
  entryUpdate.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("test entry missing", { code: "P2025", clientVersion: "test" });
  });
  const log = t.mock.method(console, "error", () => {});
  assert.match((await updateEntry(ideaId, entryId, {}, data)).error!, /no longer exists/);
  entryUpdate.mock.mockImplementation(async () => { throw new Error("test database unavailable"); });
  assert.match((await updateEntry(ideaId, entryId, {}, data)).error!, /draft is still here/);
  assert.equal(log.mock.callCount(), 2);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("photo removals and text edits are saved in one nested update without changing remaining photos", async (t) => {
  const { findFirst, entryUpdate } = await setup(t);
  findFirst.mock.mockImplementation(async () => ({ images: [{ id: imageId }, { id: secondImageId }] }));
  const data = new FormData();
  data.set("content", " [] Updated task ");
  data.append("removedImages", imageId);
  assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
  assert.deepEqual(entryUpdate.mock.calls[0].arguments[0], {
    where: { id: entryId, ideaId, idea: { deletedAt: null } },
    data: { content: "Updated task", isTodo: true, images: { deleteMany: { id: { in: [imageId] } } } },
    select: { id: true },
  });
  data.set("content", "[]");
  assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
  data.append("removedImages", secondImageId);
  assert.match((await updateEntry(ideaId, entryId, {}, data)).error!, /Write something/);
  assert.equal(entryUpdate.mock.callCount(), 2);
  data.set("content", "Keep this text");
  assert.deepEqual(await updateEntry(ideaId, entryId, {}, data), { saved: true });
  assert.deepEqual(entryUpdate.mock.calls[2].arguments[0].data, {
    content: "Keep this text", isTodo: false, completedAt: null,
    images: { deleteMany: { id: { in: [imageId, secondImageId] } } },
  });
});

test("invalid, duplicate, foreign and excessive image removal IDs cannot delete photos", async (t) => {
  const { findFirst, entryUpdate } = await setup(t);
  for (const removed of [["invalid"], [imageId, imageId], Array.from({ length: 5 }, () => imageId)]) {
    const data = new FormData();
    data.set("content", "A note");
    for (const id of removed) data.append("removedImages", id);
    assert.ok((await updateEntry(ideaId, entryId, {}, data)).error);
  }
  assert.equal(findFirst.mock.callCount(), 0);
  findFirst.mock.mockImplementation(async () => ({ images: [{ id: secondImageId }] }));
  const foreign = new FormData();
  foreign.set("content", "A note");
  foreign.append("removedImages", imageId);
  assert.match((await updateEntry(ideaId, entryId, {}, foreign)).error!, /does not belong/);
  assert.equal(entryUpdate.mock.callCount(), 0);
});

test("To-dos collects all tasks including completed tasks, omits notes and offers edit buttons", () => {
  const document = parseDocument(renderToStaticMarkup(createElement(IdeaTodos, {
    ideaId,
    entries: [
      { ...entry, id: "note", content: "A note", isTodo: false },
      entry,
      { ...entry, id: "completed", content: "Finished task", completedAt: new Date() },
    ],
  })));
  const items = DomUtils.findAll((node) => node.name === "li", document.children);
  assert.equal(items.length, 2);
  assert.equal(DomUtils.findAll((node) => node.attribs.class === "todo-status", document.children).length, 0);
  assert.doesNotMatch(DomUtils.textContent(document), /A note/);
  assert.match(DomUtils.textContent(items[0]), /Read https:\/\/example.com/);
  assert.match(DomUtils.textContent(items[1]), /Finished task/);
  assert.equal(DomUtils.findAll((node) => node.attribs["aria-label"] === "Entry options", document.children).length, 2);
  const empty = renderToStaticMarkup(createElement(IdeaTodos, { ideaId, entries: [{ ...entry, isTodo: false }] }));
  assert.match(empty, /No to-dos yet/);
});

test("to-do checkboxes reflect completion, notes stay unchanged and task links remain collected", () => {
  for (const completedAt of [null, new Date("2026-11-22T11:00:00Z")]) {
    const todo = { ...entry, completedAt };
    const html = renderToStaticMarkup(createElement(IdeaDetail, {
      idea: { ...idea, entries: [todo, { ...entry, id: "note", content: "A note", isTodo: false, completedAt: null }] },
    }));
    const document = parseDocument(html);
    const entriesTab = DomUtils.findOne((node) => node.attribs.role === "tab" && DomUtils.textContent(node) === "Entries", document.children);
    assert.ok(entriesTab);
    const entriesPanel = DomUtils.findOne((node) => node.attribs["aria-labelledby"] === entriesTab.attribs.id, document.children);
    assert.ok(entriesPanel);
    const checkboxes = DomUtils.findAll((node) => node.name === "input" && node.attribs.type === "checkbox", entriesPanel.children);
    assert.equal(checkboxes.length, 1);
    assert.equal(checkboxes[0].attribs.checked, completedAt ? "" : undefined);
    assert.match(checkboxes[0].attribs["aria-label"], completedAt ? /Reopen to-do/ : /Complete to-do/);
    assert.equal(checkboxes[0].attribs.disabled, undefined);
    const heading = DomUtils.findOne((node) => Boolean(node.attribs.class?.split(" ").includes("todo-entry-heading")), entriesPanel.children);
    assert.ok(heading);
    assert.equal(DomUtils.findAll((node) => node.name === "input" && node.attribs.type === "checkbox", heading.children).length, 0);
    assert.ok(DomUtils.findOne((node) => node.name === "time", heading.children));
    assert.equal(DomUtils.findAll((node) => node.attribs["aria-label"] === "Entry options", entriesPanel.children).length, 2);
    for (const form of DomUtils.findAll((node) => node.name === "form", document.children)) {
      assert.equal(DomUtils.findAll((node) => node.name === "input" && node.attribs.type === "checkbox", form.children).length, 0,
        "Checkbox toggles must not be reset by form submission");
    }
    const links = renderToStaticMarkup(createElement(IdeaLinks, { entries: [todo] }));
    assert.match(links, /href="https:\/\/example.com\/article"/);
    const feedHtml = renderToStaticMarkup(createElement(IdeaList, {
      page: { ideas: [{ ...idea, entries: [todo], _count: { entries: 1 } }], nextCursor: null },
      request: { kind: "search", query: "Read", cursor: null },
    }));
    assert.match(feedHtml, completedAt ? /Completed/ : /To-do/);
    assert.equal(feedHtml.includes("todo-completed"), Boolean(completedAt));
  }
});
