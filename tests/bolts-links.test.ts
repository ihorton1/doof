import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import { extractEntryLinks } from "../apps/bolts/src/lib/entry-links";
import { EntryText } from "../apps/bolts/src/components/entry-text";
import { IdeaLinks, IdeaViews } from "../apps/bolts/src/components/idea-views";
import type { IdeaDetail } from "../apps/bolts/src/lib/ideas";

function entry(id: string, content: string, date = "2026-11-22T10:00:00Z"): IdeaDetail["entries"][number] {
  return { id, content, linkedIdeaId: null, isTodo: false, completedAt: null, createdAt: new Date(date), images: [] };
}

test("link collection and inline entry text use identical URL parsing and punctuation rules", () => {
  const texts = [
    "See https://example.com/watch?v=1&list=2.\nAlso www.example.org.",
    "Try (https://example.com/a_(b)). Then [https://example.org/page]!",
    'HTTPS://example.com/a?q=1&b=2; and "www.example.org/path".',
    "javascript:alert(1) data:text/html,hi https:// <img onerror=alert(1)>",
    "Not a link. https://example.com/a_(b)), www.example.org/path!",
  ];
  for (const text of texts) {
    const links = extractEntryLinks(text);
    const document = parseDocument(renderToStaticMarkup(createElement(EntryText, { text })));
    const anchors = DomUtils.findAll((node) => node.name === "a", document.children);
    assert.deepEqual(links.map((link) => link.href), anchors.map((anchor) => anchor.attribs.href));
    assert.deepEqual(links.map((link) => link.label), anchors.map((anchor) => DomUtils.textContent(anchor)));
    for (const link of links) {
      assert.equal(text.slice(link.index, link.index + link.label.length), link.label);
      assert.ok(["http:", "https:"].includes(new URL(link.href).protocol));
    }
    assert.equal(DomUtils.textContent(document), text);
  }
  assert.deepEqual(extractEntryLinks("No web addresses here."), []);
});

test("Links lists all saved entries in order, including repeated URLs and older entries", () => {
  const entries = [
    entry("old", "First https://example.com/a then www.example.org.", "2026-11-18T10:00:00Z"),
    entry("text-only", "Just a note."),
    { ...entry("image-only", ""), images: [{ id: "image" }] },
    entry("new", "Again https://example.com/a and https://example.net/new."),
  ];
  const document = parseDocument(renderToStaticMarkup(createElement(IdeaLinks, { entries })));
  const anchors = DomUtils.findAll((node) => node.name === "a", document.children);
  assert.deepEqual(anchors.map((anchor) => anchor.attribs.href), [
    "https://example.com/a", "https://www.example.org", "https://example.com/a", "https://example.net/new",
  ]);
  for (const anchor of anchors) {
    assert.equal(anchor.attribs.target, "_blank");
    assert.equal(anchor.attribs.rel, "noopener noreferrer");
    assert.equal(DomUtils.findAll((node) => node.name === "a", anchor.children).length, 0);
  }
  const dates = DomUtils.findAll((node) => node.name === "time", document.children);
  assert.deepEqual(dates.map((date) => DomUtils.textContent(date)), ["2026-11-18", "2026-11-18", "2026-11-22", "2026-11-22"]);
  assert.equal(dates[0].attribs.datetime, "2026-11-18T10:00:00.000Z");
  assert.match(DomUtils.textContent(document), /example\.net/);
  assert.doesNotMatch(DomUtils.textContent(document), /Just a note/);
});

test("Links provides an empty state and renders URL labels as text rather than markup", () => {
  for (const entries of [[], [entry("plain", "Just a note.")], [{ ...entry("image", ""), images: [{ id: "image" }] }]]) {
    const html = renderToStaticMarkup(createElement(IdeaLinks, { entries }));
    assert.match(html, /No links yet/);
    assert.match(html, /Links from your saved entries will appear here/);
    assert.doesNotMatch(html, /<a\b/);
  }
  const html = renderToStaticMarkup(createElement(IdeaLinks, {
    entries: [entry("escaped", "https://example.com/?a=1&b=2 <script>alert(1)</script>")],
  }));
  assert.match(html, /a=1&amp;b=2/);
  assert.doesNotMatch(html, /<script|alert\(1\)/);
});

test("bolt tabs default to Entries with connected, accessible panels and mounted entry content", () => {
  const document = parseDocument(renderToStaticMarkup(createElement(IdeaViews, {
    ideaId: "cmivnlm9w0000356l5ih14d7z",
    entries: [entry("linked", "https://example.com")],
  }, createElement("textarea", { name: "content", defaultValue: "Unsaved draft" }))));
  const tabs = DomUtils.findAll((node) => node.attribs.role === "tab", document.children);
  const panels = DomUtils.findAll((node) => node.attribs.role === "tabpanel", document.children);
  assert.deepEqual(tabs.map((tab) => DomUtils.textContent(tab)), ["Entries", "To-dos", "Links"]);
  assert.deepEqual(tabs.map((tab) => tab.attribs["aria-selected"]), ["true", "false", "false"]);
  assert.deepEqual(tabs.map((tab) => tab.attribs.tabindex), ["0", "-1", "-1"]);
  for (const [index, tab] of tabs.entries()) {
    assert.equal(tab.attribs["aria-controls"], panels[index].attribs.id);
    assert.equal(panels[index].attribs["aria-labelledby"], tab.attribs.id);
  }
  assert.equal(panels[0].attribs.hidden, undefined);
  assert.equal(panels[1].attribs.hidden, "");
  assert.equal(panels[2].attribs.hidden, "");
  assert.match(DomUtils.textContent(panels[0]), /Unsaved draft/);
  assert.match(DomUtils.textContent(panels[1]), /No to-dos yet/);
  assert.match(DomUtils.textContent(panels[2]), /https:\/\/example.com/);
});
