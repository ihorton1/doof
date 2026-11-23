import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { addEntry, createIdea, updateIdeaTitle } from "../apps/bolts/src/app/actions";
import { GET } from "../apps/bolts/src/app/images/[id]/route";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../apps/bolts/src/lib/auth";
import { entryImagePath, imageContentType, MAX_ENTRY_IMAGE_BYTES, validateEntryImages } from "../apps/bolts/src/lib/entry-images";
import { entrySchema } from "../apps/bolts/src/lib/ideas";
import { getPrisma } from "../apps/bolts/src/lib/prisma";
import { Prisma, type Idea } from "../apps/bolts/src/generated/prisma/client";
import { IdeaDetail } from "../apps/bolts/src/components/idea-detail";
import { IdeaList } from "../apps/bolts/src/components/idea-list";

const ideaId = "cmivnlm9w0000356l5ih14d7z";
const imageId = "cmivnlm9w0001356l5ih14d7z";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const record = {
  id: ideaId, title: "An illustrated thought", createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"), deletedAt: null, archivedAt: null,
  dueAt: new Date("2026-01-01T00:00:00Z"), snoozeCount: 0, pendingDismissal: true,
};

function entryData(content = "", count = 1) {
  const data = new FormData();
  data.set("content", content);
  for (let i = 0; i < count; i++) data.append("images", new File([png], `clipboard-${i}.png`, { type: "image/png" }));
  return data;
}

async function setup(t: TestContext, authenticated = true) {
  for (const [key, value] of Object.entries({
    BOLTS_DATABASE_URL: "postgresql://localhost:1/bolts_images_test",
    BOLTS_COOKIE_SECRET: "test-only-bolts-images-secret",
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
  const update = t.mock.fn<(_args: Prisma.IdeaUpdateArgs) => Promise<Idea>>(async () => ({ ...record }));
  const create = t.mock.fn<(_args: Prisma.IdeaCreateArgs) => Promise<Idea>>(async () => ({ ...record }));
  const findFirst = t.mock.fn<(_args: Prisma.IdeaEntryImageFindFirstArgs) => Promise<{ data: Uint8Array; contentType: string } | null>>(
    async () => ({ data: new Uint8Array(png), contentType: "image/png" }),
  );
  for (const [delegate, key, value] of [
    [prisma.idea, "update", update],
    [prisma.idea, "create", create],
    [prisma.ideaEntryImage, "findFirst", findFirst],
  ] as const) {
    const original = Reflect.get(delegate, key);
    Object.defineProperty(delegate, key, { value, configurable: true, writable: true });
    t.after(() => Object.defineProperty(delegate, key, { value: original, configurable: true, writable: true }));
  }
  return { update, create, findFirst, revalidate };
}

test("new untitled bolts save an image-only first entry atomically", async (t) => {
  const { create, update } = await setup(t);
  await assert.rejects(() => createIdea({}, entryData(" ", 2)), /NEXT_REDIRECT/);
  const args = create.mock.calls[0].arguments[0];
  assert.equal(args.data.title, "");
  assert.deepEqual(args.data.entries, { create: {
    content: "",
    isTodo: false,
    images: { create: [0, 1].map((position) => ({ contentType: "image/png", position, data: new Uint8Array(png) })) },
  } });
  assert.equal(update.mock.callCount(), 0);
});

test("invalid first-entry images and database failures never report a saved bolt", async (t) => {
  const { create, revalidate } = await setup(t);
  const invalid = entryData("note", 0);
  invalid.append("images", new File(["not a PNG"], "fake.png", { type: "image/png" }));
  assert.match((await createIdea({}, invalid)).error!, /could not be read/);
  assert.equal(create.mock.callCount(), 0);
  create.mock.mockImplementation(async () => { throw new Error("test database unavailable"); });
  const log = t.mock.method(console, "error", () => {});
  assert.match((await createIdea({}, entryData())).error!, /text and images are still here/);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("deleted bolts cannot have a title added", async (t) => {
  const { update, revalidate } = await setup(t);
  update.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("test record missing", { code: "P2025", clientVersion: "test" });
  });
  t.mock.method(console, "error", () => {});
  const data = new FormData();
  data.set("title", "A title");
  assert.match((await updateIdeaTitle(ideaId, {}, data)).error!, /no longer exists/);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("entry image bounds accept exactly four images and 4 MB, rejecting larger totals and unsafe types", () => {
  assert.equal(validateEntryImages([]), undefined);
  const image = { size: MAX_ENTRY_IMAGE_BYTES / 4, type: "image/png" };
  assert.equal(validateEntryImages(Array.from({ length: 4 }, () => image)), undefined);
  assert.match(validateEntryImages([{ ...image, size: MAX_ENTRY_IMAGE_BYTES + 1 }])!, /4 MB/);
  assert.match(validateEntryImages(Array.from({ length: 5 }, () => image))!, /four images/);
  for (const type of ["image/svg+xml", "text/html", "application/pdf", ""]) {
    assert.match(validateEntryImages([{ size: 12, type }])!, /PNG, JPEG, GIF or WebP/);
  }
  assert.match(validateEntryImages([{ size: 0, type: "image/png" }])!, /empty/);
});

test("raster signatures identify PNG, JPEG, GIF and WebP rather than trusting filenames or MIME labels", () => {
  assert.equal(imageContentType(png), "image/png");
  assert.equal(imageContentType(new Uint8Array([255, 216, 255, 217])), "image/jpeg");
  assert.equal(imageContentType(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")), "image/gif");
  const webp = Buffer.alloc(20);
  webp.write("RIFF");
  webp.writeUInt32LE(12, 4);
  webp.write("WEBP", 8);
  assert.equal(imageContentType(webp), "image/webp");
  webp.writeUInt32LE(13, 4);
  assert.equal(imageContentType(webp), null);
  for (const value of ["<svg><script>alert(1)</script></svg>", "<html>Not an image</html>", ""]) {
    assert.equal(imageContentType(Buffer.from(value)), null);
  }
  assert.equal(imageContentType(png.subarray(0, 8)), null);
});

test("entry validation allows images with blank text but not empty entries or invalid image counts", () => {
  assert.equal(entrySchema.parse({ ideaId, content: "  ", imageCount: 1 }).content, "");
  assert.equal(entrySchema.safeParse({ ideaId, content: "", imageCount: 0 }).success, false);
  assert.equal(entrySchema.safeParse({ ideaId, content: "", imageCount: 5 }).success, false);
  assert.equal(entrySchema.safeParse({ ideaId, content: "a".repeat(20001), imageCount: 1 }).success, false);
});

test("image-only contributions save attachments atomically, in clipboard order, without rescheduling", async (t) => {
  const { update, revalidate } = await setup(t);
  assert.deepEqual(await addEntry(ideaId, {}, entryData("  ", 2)), { saved: true });
  const args = update.mock.calls[0].arguments[0];
  assert.deepEqual(args.where, { id: ideaId, deletedAt: null });
  assert.equal(args.data.pendingDismissal, true);
  assert.equal("dueAt" in args.data, false);
  assert.equal("snoozeCount" in args.data, false);
  assert.deepEqual(args.data.entries, { create: {
    content: "",
    isTodo: false,
    images: { create: [0, 1].map((position) => ({ contentType: "image/png", position, data: new Uint8Array(png) })) },
  } });
  assert.deepEqual(revalidate.mock.calls.map((call) => call.arguments[0]), [
    "/bolts/", "/bolts/search", `/bolts/ideas/${ideaId}`,
  ]);
});

test("plain-text entries remain valid without attachments", async (t) => {
  const { update } = await setup(t);
  assert.deepEqual(await addEntry(ideaId, {}, entryData("  A note  ", 0)), { saved: true });
  assert.deepEqual(update.mock.calls[0].arguments[0].data.entries, { create: { content: "A note", isTodo: false } });
});

test("invalid image submissions never write entries or dismissal state", async (t) => {
  const { update } = await setup(t);
  const cases = [entryData("", 0), entryData("note", 5)];
  const invalidType = entryData("note", 0);
  invalidType.append("images", "not a file");
  cases.push(invalidType);
  for (const [body, type] of [["<svg/>", "image/svg+xml"], ["not a PNG", "image/png"], [png, "image/jpeg"], ["", "image/png"]] as const) {
    const data = entryData("note", 0);
    data.append("images", new File([body], "fake.png", { type }));
    cases.push(data);
  }
  const oversized = entryData("", 0);
  oversized.append("images", new File([new Uint8Array(MAX_ENTRY_IMAGE_BYTES + 1)], "large.png", { type: "image/png" }));
  cases.push(oversized);
  for (const data of cases) assert.ok((await addEntry(ideaId, {}, data)).error);
  assert.equal(update.mock.callCount(), 0);
});

test("save failures preserve submitted text and image files for retry, and deleted bolts reject attachments", async (t) => {
  const { update, revalidate } = await setup(t);
  const log = t.mock.method(console, "error", () => {});
  update.mock.mockImplementation(async () => { throw new Error("test database unavailable"); });
  const data = entryData("Keep my draft");
  assert.match((await addEntry(ideaId, {}, data)).error!, /text and images are still here/);
  assert.equal(data.get("content"), "Keep my draft");
  assert.equal(data.getAll("images").length, 1);
  assert.equal(revalidate.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 1);
  update.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("deleted", { code: "P2025", clientVersion: "test" });
  });
  assert.match((await addEntry(ideaId, {}, data)).error!, /no longer exists/);
});

test("uploads and image delivery require a session before any database access", async (t) => {
  const { update, findFirst } = await setup(t, false);
  await assert.rejects(() => addEntry(ideaId, {}, entryData()), /NEXT_REDIRECT/);
  await assert.rejects(() => GET(new Request("http://localhost/"), { params: Promise.resolve({ id: imageId }) }), /NEXT_REDIRECT/);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(findFirst.mock.callCount(), 0);
});

test("image responses are private, unoptimized raster bytes scoped to nondeleted bolts", async (t) => {
  const { findFirst } = await setup(t);
  const response = await GET(new Request("http://localhost/"), { params: Promise.resolve({ id: imageId }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), String(png.length));
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(png));
  assert.deepEqual(findFirst.mock.calls[0].arguments[0], {
    where: { id: imageId, entry: { idea: { deletedAt: null } } },
    select: { contentType: true, data: true },
  });
});

test("missing and invalid images return 404, and database errors return an explicit 500", async (t) => {
  const { findFirst } = await setup(t);
  const request = new Request("http://localhost/");
  assert.equal((await GET(request, { params: Promise.resolve({ id: "invalid" }) })).status, 404);
  assert.equal(findFirst.mock.callCount(), 0);
  findFirst.mock.mockImplementation(async () => null);
  assert.equal((await GET(request, { params: Promise.resolve({ id: imageId }) })).status, 404);
  findFirst.mock.mockImplementation(async () => { throw new Error("test database unavailable"); });
  const log = t.mock.method(console, "error", () => {});
  const failed = await GET(request, { params: Promise.resolve({ id: imageId }) });
  assert.equal(failed.status, 500);
  assert.equal(failed.headers.get("cache-control"), "private, no-store");
  assert.match(await failed.text(), /could not be loaded/);
  assert.equal(log.mock.callCount(), 1);
});

test("detail and feed display authenticated inline images without nested links or empty text", () => {
  const entries = [{ id: "entry", content: "", linkedIdeaId: null, isTodo: false, completedAt: null, createdAt: record.createdAt, images: [{ id: imageId }] }];
  const detail = renderToStaticMarkup(createElement(IdeaDetail, { idea: { ...record, entries } }));
  const feed = renderToStaticMarkup(createElement(IdeaList, {
    page: { ideas: [{ ...record, entries, _count: { entries: 1 } }], nextCursor: null },
    request: { kind: "due", asOf: "2026-11-19T00:00:00.000Z", cursor: null },
  }));
  for (const html of [detail, feed]) {
    const document = parseDocument(html);
    const images = DomUtils.findAll((node) => node.name === "img", document.children);
    assert.equal(images.length, 1);
    assert.equal(images[0].attribs.src, entryImagePath(imageId));
    assert.equal(images[0].attribs.srcset, undefined);
    const link = images[0].parent;
    assert.ok(link && link.type === "tag");
    assert.equal(link.name, "a");
    assert.equal(link.attribs.href, entryImagePath(imageId));
    assert.equal(link.attribs.target, "_blank");
    assert.doesNotMatch(html, /<p><\/p>/);
    for (const anchor of DomUtils.findAll((node) => node.name === "a", document.children)) {
      assert.equal(DomUtils.findAll((node) => node.name === "a", anchor.children).length, 0);
    }
  }
  assert.doesNotMatch(detail, /Paste images into this field|entry-image-hint|four images|4 MB/);
});
