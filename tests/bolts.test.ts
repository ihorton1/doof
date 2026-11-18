import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import { EntryText } from "../apps/bolts/src/components/entry-text";
import { IdeaList } from "../apps/bolts/src/components/idea-list";
import { IdeaDetail } from "../apps/bolts/src/components/idea-detail";
import NewIdeaPage from "../apps/bolts/src/app/ideas/new/page";
import { entrySchema, ideaTitleSchema } from "../apps/bolts/src/lib/ideas";
import manifest from "../apps/bolts/src/app/manifest";
import Icon from "../apps/bolts/src/app/icon";
import AppleIcon from "../apps/bolts/src/app/apple-icon";

const ideaId = "cmivnlm9w0000356l5ih14d7z";

test("entry text links web addresses without changing surrounding text or line breaks", () => {
  const html = renderToStaticMarkup(createElement(EntryText, {
    text: "See https://example.com/watch?v=1&list=2.\nAlso www.example.org.",
  }));
  const document = parseDocument(html);
  assert.equal(DomUtils.textContent(document), "See https://example.com/watch?v=1&list=2.\nAlso www.example.org.");
  const links = DomUtils.findAll((node) => node.name === "a", document.children);
  assert.deepEqual(links.map((link) => link.attribs.href), [
    "https://example.com/watch?v=1&list=2", "https://www.example.org",
  ]);
  for (const link of links) {
    assert.equal(link.attribs.target, "_blank");
    assert.equal(link.attribs.rel, "noopener noreferrer");
  }
});

test("entry links keep balanced URL parentheses but exclude surrounding punctuation", () => {
  const html = renderToStaticMarkup(createElement(EntryText, {
    text: "Try (https://example.com/a_(b)). Then [https://example.org/page]!",
  }));
  const document = parseDocument(html);
  const links = DomUtils.findAll((node) => node.name === "a", document.children);
  assert.deepEqual(links.map((link) => link.attribs.href), [
    "https://example.com/a_(b)", "https://example.org/page",
  ]);
  assert.equal(DomUtils.textContent(document), "Try (https://example.com/a_(b)). Then [https://example.org/page]!");
});

test("unsafe schemes, invalid URLs and markup stay plain text", () => {
  const text = "javascript:alert(1) data:text/html,hi https:// <img onerror=alert(1)>";
  const html = renderToStaticMarkup(createElement(EntryText, { text }));
  assert.doesNotMatch(html, /<a\b|<img\b/);
  assert.equal(DomUtils.textContent(parseDocument(html)), text);
});

test("feed links are independently clickable without nesting anchors inside card navigation", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, {
    ideas: [{
      id: ideaId, title: "A linked idea", _count: { entries: 1 },
      entries: [{ content: "https://example.com/resource", createdAt: new Date("2026-11-18T10:00:00Z") }],
    }],
  }));
  const links = DomUtils.findAll((node) => node.name === "a", parseDocument(html).children);
  assert.ok(links.some((link) => link.attribs.href === `/ideas/${ideaId}`));
  assert.ok(links.some((link) => link.attribs.href === "https://example.com/resource"));
  for (const link of links) {
    assert.equal(DomUtils.findAll((node) => node.name === "a", link.children).length, 0);
  }
});

test("Bolts home shows linked idea cards with entry counts", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, {
    ideas: [
      {
        id: ideaId, title: "Idea 1", _count: { entries: 1 },
        entries: [{ content: "The latest discovery.", createdAt: new Date("2026-11-18T10:00:00Z") }],
      },
      {
        id: "cmivnlm9w0001356l5ih14d7z", title: "Idea 2", _count: { entries: 3 },
        entries: [{ content: "Another recent thought.", createdAt: new Date("2026-11-17T09:00:00Z") }],
      },
    ],
  }));
  assert.match(html, /<h1>Your bolts<\/h1>/);
  assert.match(html, /aria-label="Your bolts"/);
  assert.doesNotMatch(html, /Small thoughts\. Room to grow\./);
  assert.match(html, new RegExp(`href="/ideas/${ideaId}"`));
  assert.match(html, /Idea 1/);
  assert.match(html, /1 entry/);
  assert.match(html, /3 entries/);
  assert.match(html, /The latest discovery\./);
  assert.match(html, /Another recent thought\./);
  assert.match(html, /dateTime="2026-11-18T10:00:00.000Z"/i);
  assert.match(html, />2026-11-17<\/time>/);
  assert.match(html, /href="\/ideas\/new"/);
  assert.doesNotMatch(html, /Save idea/);
  assert.doesNotMatch(html, /name="title"/);
});

test("feed ideas without entries do not invent preview text or an entry date", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, {
    ideas: [{ id: ideaId, title: "Just started", _count: { entries: 0 }, entries: [] }],
  }));
  assert.match(html, /Just started/);
  assert.match(html, /0 entries/);
  assert.doesNotMatch(html, /<time/);
  assert.doesNotMatch(html, /idea-card-preview/);
});

test("New idea opens a dedicated idea widget with a title form and a way back", () => {
  const html = renderToStaticMarkup(createElement(NewIdeaPage));
  assert.match(html, /class="detail-sheet"/);
  assert.match(html, /<h1 class="visually-hidden">New idea<\/h1>/);
  assert.match(html, /name="title"/);
  assert.match(html, /placeholder="title\.\.\."/);
  assert.match(html, /class="idea-title-input"/);
  assert.match(html, /<label[^>]*>Idea title<\/label>/);
  assert.match(html, /Save idea/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /name="content"/);
});

test("Bolts empty home explains how to start without fake ideas", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, { ideas: [] }));
  assert.match(html, /Every idea starts somewhere/);
  assert.doesNotMatch(html, /class="idea-card"/);
});

test("idea detail renders the title, dated entries, line breaks and entry form", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: {
      id: ideaId,
      title: "Make a list of inspiring people",
      entries: [{
        id: "entry-1",
        content: "A useful discovery.\nA second thought. https://example.com",
        createdAt: new Date("2026-11-18T10:00:00Z"),
      }],
    },
  }));
  assert.match(html, /<h1>Make a list of inspiring people<\/h1>/);
  assert.match(html, /dateTime="2026-11-18T10:00:00.000Z"/i);
  assert.match(html, /2026-11-18/);
  assert.match(html, /A useful discovery\.\nA second thought\./);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /href="\/"/);
  assert.match(html, /name="content"/);
  assert.match(html, /Add entry/);
  assert.doesNotMatch(html, /Dated automatically when you save/);
});

test("empty idea detail provides a first-entry prompt", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: { id: ideaId, title: "Something new", entries: [] },
  }));
  assert.match(html, /A place to build on this thought/);
  assert.match(html, /Add to this idea/);
});

test("idea titles and entry text are rendered as text, not markup", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: {
      id: ideaId,
      title: "<script>alert(1)</script>",
      entries: [{ id: "1", content: "<img onerror=alert(1)>", createdAt: new Date() }],
    },
  }));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img onerror/);
});

test("idea validation trims titles and enforces exact size limits", () => {
  assert.equal(ideaTitleSchema.parse("  A thought  "), "A thought");
  assert.equal(ideaTitleSchema.safeParse(" ").success, false);
  assert.equal(ideaTitleSchema.safeParse("a".repeat(200)).success, true);
  assert.equal(ideaTitleSchema.safeParse("a".repeat(201)).success, false);
});

test("entry validation requires an existing-style id and nonblank bounded content", () => {
  assert.deepEqual(entrySchema.parse({ ideaId, content: "  Keep\nthis  " }), {
    ideaId, content: "Keep\nthis",
  });
  assert.equal(entrySchema.safeParse({ ideaId, content: " " }).success, false);
  assert.equal(entrySchema.safeParse({ ideaId: "../other", content: "note" }).success, false);
  assert.equal(entrySchema.safeParse({ ideaId, content: "a".repeat(20000) }).success, true);
  assert.equal(entrySchema.safeParse({ ideaId, content: "a".repeat(20001) }).success, false);
});

test("Bolts has an independent standalone home-screen identity", () => {
  const app = manifest();
  assert.equal(app.name, "Bolts");
  assert.equal(app.id, "/bolts/");
  assert.equal(app.start_url, "/bolts/");
  assert.equal(app.scope, "/bolts/");
  assert.equal(app.display, "standalone");
  assert.deepEqual(app.icons, [
    { src: "/bolts/icon", sizes: "512x512", type: "image/png" },
  ]);
});

for (const [name, render, dimension] of [
  ["manifest", Icon, 512],
  ["Apple touch", AppleIcon, 180],
] as const) {
  test(`Bolts ${name} icon is a PNG with the declared dimensions`, async () => {
    const response = render();
    assert.equal(response.headers.get("content-type"), "image/png");
    const png = Buffer.from(await response.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), dimension);
    assert.equal(png.readUInt32BE(20), dimension);
  });
}
