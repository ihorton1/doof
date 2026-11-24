import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import { EntryText } from "../apps/bolts/src/components/entry-text";
import { IdeaList } from "../apps/bolts/src/components/idea-list";
import { IdeaDetail } from "../apps/bolts/src/components/idea-detail";
import NewIdeaPage from "../apps/bolts/src/app/ideas/new/page";
import { entrySchema, ideaTitleSchema, type IdeaSummary } from "../apps/bolts/src/lib/ideas";
import manifest from "../apps/bolts/src/app/manifest";
import Icon from "../apps/bolts/src/app/icon";
import AppleIcon from "../apps/bolts/src/app/apple-icon";
import { ThemeForm } from "../apps/bolts/src/app/settings/theme-form";
import { getTheme, themeSchema } from "../apps/bolts/src/lib/theme";

const ideaId = "cmivnlm9w0000356l5ih14d7z";
const schedule = { dueAt: new Date("2026-11-18T00:00:00Z"), createdAt: new Date("2026-11-17T00:00:00Z"), snoozeCount: 0, archivedAt: null };
function feed(ideas: IdeaSummary[]) {
  return {
    page: { ideas, nextCursor: null },
    request: { kind: "due" as const, asOf: "2026-11-19T00:00:00.000Z", cursor: null },
  };
}

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
  const html = renderToStaticMarkup(createElement(IdeaList, feed(
    [{
      ...schedule,
      id: ideaId, title: "A linked idea", _count: { entries: 1 },
      entries: [{ content: "https://example.com/resource", linkedIdeaId: null, isTodo: false, completedAt: null, createdAt: new Date("2026-11-18T10:00:00Z"), images: [] }],
    }],
  )));
  const links = DomUtils.findAll((node) => node.name === "a", parseDocument(html).children);
  assert.ok(links.some((link) => link.attribs.href === `/ideas/${ideaId}`));
  assert.ok(links.some((link) => link.attribs.href === "https://example.com/resource"));
  for (const link of links) {
    assert.equal(DomUtils.findAll((node) => node.name === "a", link.children).length, 0);
  }
});

test("Bolts home shows linked idea cards with entry counts", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, feed(
    [
      {
        ...schedule,
        id: ideaId, title: "Idea 1", _count: { entries: 1 },
        entries: [{ content: "The latest discovery.", linkedIdeaId: null, isTodo: false, completedAt: null, createdAt: new Date("2026-11-18T10:00:00Z"), images: [] }],
      },
      {
        ...schedule,
        id: "cmivnlm9w0001356l5ih14d7z", title: "Idea 2", _count: { entries: 3 },
        entries: [{ content: "Another recent thought.", linkedIdeaId: null, isTodo: false, completedAt: null, createdAt: new Date("2026-11-17T09:00:00Z"), images: [] }],
      },
    ],
  )));
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

test("feed header pairs the lightning wordmark with the user menu and keeps new bolt in bottom navigation", () => {
  const document = parseDocument(renderToStaticMarkup(createElement(IdeaList, feed([]))));
  const header = DomUtils.findOne((node) => node.name === "header", document.children);
  assert.ok(header);
  const children = DomUtils.findAll((node) => node.parent === header, header.children);
  assert.deepEqual(children.map((node) => node.name), ["p", "details", "h1"]);
  assert.equal(DomUtils.textContent(children[0]), "\u26a1 bolts.");
  assert.equal(children[0].children[0].type, "tag");
  const icon = DomUtils.findOne((node) => node.name === "span", children[0].children);
  assert.equal(icon?.attribs["aria-hidden"], "true");
  assert.equal(children[1].attribs.open, undefined);
  const menuSummary = DomUtils.findOne((node) => node.name === "summary", children[1].children);
  assert.equal(menuSummary?.attribs["aria-label"], "User menu");
  const settings = DomUtils.findOne((node) => node.name === "a", children[1].children);
  assert.equal(settings?.attribs.href, "/settings");
  assert.equal(DomUtils.textContent(settings!), "Settings");
  assert.ok(DomUtils.findOne((node) => node.name === "button" && DomUtils.textContent(node) === "Sign out", children[1].children));
  assert.equal(DomUtils.textContent(children[2]), "Your bolts");
});

test("feed search is a bottom navigation action after the feed, including when empty", () => {
  const document = parseDocument(renderToStaticMarkup(createElement(IdeaList, feed([]))));
  const main = DomUtils.findOne((node) => node.name === "main", document.children);
  assert.ok(main);
  assert.ok(main.attribs.class.split(" ").includes("due-feed"));
  const children = DomUtils.findAll((node) => node.parent === main, main.children);
  const navigation = children.at(-1);
  assert.ok(navigation);
  assert.equal(navigation.name, "nav");
  assert.equal(navigation.attribs["aria-label"], "Bolts navigation");
  const link = DomUtils.findOne((node) => node.name === "a", navigation.children);
  assert.ok(link);
  assert.equal(link.attribs.href, "/search");
  assert.ok(link.attribs.class.split(" ").includes("feed-search"));
  assert.equal(DomUtils.textContent(link).trim(), "Search bolts");
  const icon = DomUtils.findOne((node) => node.name === "svg", link.children);
  assert.equal(icon?.attribs["aria-hidden"], "true");
  const links = DomUtils.findAll((node) => node.name === "a", navigation.children);
  assert.deepEqual(links.map((item) => item.attribs.href), ["/search", "/ideas/new"]);
  assert.equal(DomUtils.textContent(links[1]), "\u26a1 New bolt");
  const boltIcon = DomUtils.findOne((node) => node.name === "span", links[1].children);
  assert.equal(boltIcon?.attribs["aria-hidden"], "true");
});

test("feed ideas without entries do not invent preview text or an entry date", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, feed(
    [{ ...schedule, id: ideaId, title: "Just started", _count: { entries: 0 }, entries: [] }],
  )));
  assert.match(html, /Just started/);
  assert.match(html, /0 entries/);
  assert.doesNotMatch(html, /<time/);
  assert.doesNotMatch(html, /idea-card-preview/);
});

test("title menu actions show a decorative pencil icon for both adding and editing titles", () => {
  for (const title of ["", "A bolt"]) {
    const document = parseDocument(renderToStaticMarkup(createElement(IdeaDetail, {
      idea: { id: ideaId, title, pendingDismissal: false, archivedAt: null, entries: [] },
    })));
    const button = DomUtils.findOne((node) => node.name === "button" && DomUtils.textContent(node).trim() === (title ? "Edit title" : "Add title"), document.children);
    assert.ok(button);
    const icon = DomUtils.findOne((node) => node.name === "svg", button.children);
    assert.equal(icon?.attribs["aria-hidden"], "true");
    assert.equal(icon?.attribs.width, "20");
    assert.equal(icon?.attribs.height, "20");
  }
});

test("New bolt starts with a focused entry editor and an optional title in the options menu", () => {
  const html = renderToStaticMarkup(createElement(NewIdeaPage));
  assert.match(html, /class="detail-sheet"/);
  assert.match(html, /<h1 class="visually-hidden">New bolt<\/h1>/);
  assert.match(html, /aria-label="Bolt options"/);
  assert.match(html, /Add title/);
  assert.match(html, /name="content"/);
  assert.doesNotMatch(html, /Start with an entry/);
  const label = DomUtils.findOne((node) => node.name === "label" && node.attribs.for === "entry-content", parseDocument(html).children);
  assert.equal(label?.attribs.class, "visually-hidden");
  assert.equal(DomUtils.textContent(label!), "Entry");
  assert.match(html, /<textarea[^>]*autofocus/i);
  assert.match(html, /Add entry/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /idea-title-input|Save idea|Save title/);
});

test("Bolts empty home explains how to start without fake ideas", () => {
  const html = renderToStaticMarkup(createElement(IdeaList, feed([])));
  assert.match(html, /Nothing due right now/);
  assert.match(html, /href="\/search"/);
  assert.doesNotMatch(html, /class="idea-card"/);
});

test("idea detail renders the title, dated entries, line breaks and entry form", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: {
      id: ideaId,
      pendingDismissal: false,
      archivedAt: null,
      title: "Make a list of inspiring people",
      entries: [{
        id: "entry-1",
        content: "A useful discovery.\nA second thought. https://example.com",
        linkedIdeaId: null,
        isTodo: false,
        completedAt: null,
        createdAt: new Date("2026-11-18T10:00:00Z"),
        images: [],
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
  const entryForm = DomUtils.findOne((node) => node.name === "form" && node.attribs.class.includes("entry-form"), parseDocument(html).children);
  assert.match(html, /Edit title/);
  assert.match(html, /<textarea[^>]*autofocus/i);
  assert.ok(entryForm);
  assert.equal(DomUtils.findAll((node) => node.attribs.role === "status", entryForm.children).length, 0);
  assert.doesNotMatch(html, /Entry saved/);
  const deletion = DomUtils.findOne((node) => node.name === "details" && node.attribs.class === "delete-idea", parseDocument(html).children);
  assert.ok(deletion);
  assert.equal(deletion.attribs.open, undefined);
  const confirmation = DomUtils.findOne((node) => node.name === "p" && node.attribs.class === "delete-confirmation", deletion.children);
  assert.ok(confirmation);
  assert.equal(DomUtils.textContent(confirmation), "Are you sure?");
  const cancel = DomUtils.findOne((node) => node.name === "button" && DomUtils.textContent(node) === "Cancel", deletion.children);
  assert.equal(cancel?.attribs.type, "button");
  const confirm = DomUtils.findOne((node) => node.name === "button" && DomUtils.textContent(node) === "Delete idea", deletion.children);
  assert.equal(confirm?.attribs.type, "submit");
  assert.doesNotMatch(html, /Dated automatically when you save/);
});

test("untitled bolts keep accessible navigation and expose Add title without a visible placeholder heading", () => {
  const idea = { ...schedule, id: ideaId, title: "", pendingDismissal: false, entries: [] };
  const html = renderToStaticMarkup(createElement(IdeaDetail, { idea }));
  assert.match(html, /<h1 class="visually-hidden">Untitled bolt<\/h1>/);
  assert.match(html, /Add title/);
  assert.doesNotMatch(html, /idea-title-input|Edit title/);
  const feedHtml = renderToStaticMarkup(createElement(IdeaList, feed([{ ...idea, _count: { entries: 0 } }])));
  assert.match(feedHtml, new RegExp(`href="/ideas/${ideaId}"[^>]*>Untitled bolt</a>`));
  assert.match(feedHtml, /Actions for Untitled bolt/);
  assert.match(feedHtml, /Snooze Untitled bolt for 1 day/);
  assert.match(feedHtml, /Archive Untitled bolt/);
});

test("appearance has exactly two validated choices and reflects the stored theme", () => {
  for (const theme of ["light", "dark"] as const) {
    const document = parseDocument(renderToStaticMarkup(createElement(ThemeForm, { theme })));
    const choices = DomUtils.findAll((node) => node.name === "button" && node.attribs.name === "theme", document.children);
    assert.deepEqual(choices.map((choice) => choice.attribs.value), ["light", "dark"]);
    for (const choice of choices) assert.equal(choice.attribs["aria-pressed"], String(choice.attribs.value === theme));
    assert.equal(themeSchema.parse(theme), theme);
    assert.equal(getTheme(theme), theme);
  }
  assert.equal(themeSchema.safeParse("system").success, false);
  assert.equal(themeSchema.safeParse(null).success, false);
  assert.equal(getTheme(undefined), "light");
  assert.equal(getTheme("invalid-cookie"), "light");
});

test("empty idea detail provides a first-entry prompt", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: { id: ideaId, title: "Something new", entries: [], pendingDismissal: false, archivedAt: null },
  }));
  assert.match(html, /A place to build on this thought/);
  assert.match(html, /Add to this idea/);
});

test("idea titles and entry text are rendered as text, not markup", () => {
  const html = renderToStaticMarkup(createElement(IdeaDetail, {
    idea: {
      id: ideaId,
      pendingDismissal: false,
      archivedAt: null,
      title: "<script>alert(1)</script>",
      entries: [{ id: "1", content: "<img onerror=alert(1)>", linkedIdeaId: null, isTodo: false, completedAt: null, createdAt: new Date(), images: [] }],
    },
  }));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img onerror/);
});

test("idea validation trims titles and enforces exact size limits", () => {
  assert.equal(ideaTitleSchema.parse("  A thought  "), "A thought");
  assert.equal(ideaTitleSchema.parse(" "), "");
  assert.equal(ideaTitleSchema.parse(""), "");
  assert.equal(ideaTitleSchema.safeParse("a".repeat(200)).success, true);
  assert.equal(ideaTitleSchema.safeParse("a".repeat(201)).success, false);
});

test("entry validation requires an existing-style id and nonblank bounded content", () => {
  assert.deepEqual(entrySchema.parse({ ideaId, content: "  Keep\nthis  " }), {
    ideaId, content: "Keep\nthis", imageCount: 0,
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
