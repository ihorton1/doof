import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomUtils, parseDocument } from "htmlparser2";
import { isHomeSwipe, BoltShell } from "../apps/bolts/src/components/bolt-shell";
import { IdeaHeader } from "../apps/bolts/src/components/idea-header";
import { NewEntryForm } from "../apps/bolts/src/components/idea-forms";

const start = { id: 1, x: 100, y: 200 };

test("the home preview shares page padding at both mobile and desktop widths", () => {
  const css = readFileSync(new URL("../apps/bolts/src/app/globals.css", import.meta.url), "utf8");
  const rules = Array.from(css.matchAll(/body,\s*\.swipe-home-preview\s*\{([^}]+)\}/g), (match) => match[1]);
  assert.equal(rules.length, 2);
  assert.match(rules[0], /padding:\s*max\(1\.25rem, env\(safe-area-inset-top\)\)/);
  assert.match(rules[0], /env\(safe-area-inset-bottom\)/);
  assert.match(rules[1], /padding-top:\s*3rem/);
  assert.match(rules[1], /padding-bottom:\s*3rem/);
});

test("home swipe commits after 80px, not a full screen, and requires twice the vertical distance", () => {
  assert.equal(isHomeSwipe(start, { x: 180, y: 240 }), true);
  assert.equal(isHomeSwipe(start, { x: 179, y: 200 }), false);
  assert.equal(isHomeSwipe(start, { x: 180, y: 241 }), false);
  assert.equal(isHomeSwipe(start, { x: 200, y: 200 }), true);
  assert.equal(isHomeSwipe(start, { x: 20, y: 200 }), false);
  assert.equal(isHomeSwipe(start, { x: 100, y: 300 }), false);
});

test("bolt shell preserves the detail layout, accessible home link and children", () => {
  const html = renderToStaticMarkup(createElement(BoltShell, null,
    createElement(IdeaHeader), createElement("p", null, "A bolt")));
  assert.match(html, /<main class="detail-shell swipe-home" data-swipe-phase="idle" style="--swipe-offset:0px">/);
  assert.match(html, /<main[^>]*><article class="detail-sheet"><header class="detail-header"><a class="back-link"/);
  assert.match(html, /class="back-link" href="\/"/);
  assert.match(html, /Due bolts/);
  assert.match(html, /<p>A bolt<\/p><\/article><\/main>/);
});

test("saved and new bolt headers put Due bolts, the logo and options together before the title", () => {
  for (const props of [{}, { ideaId: "cmivnlm9w0000356l5ih14d7z", title: "A thought" }]) {
    const document = parseDocument(renderToStaticMarkup(createElement(IdeaHeader, props)));
    const header = DomUtils.findOne((node) => node.name === "header", document.children)!;
    const children = DomUtils.findAll((node) => node.parent === header, header.children);
    assert.deepEqual(children.map((node) => node.name), ["a", "p", "details", "h1"]);
    assert.equal(children[0].attribs.href, "/");
    assert.match(DomUtils.textContent(children[0]), /Due bolts/);
    assert.equal(children[1].attribs.class, "wordmark");
    const options = DomUtils.findOne((node) => node.name === "summary", children[2].children)!;
    assert.equal(options.attribs["aria-label"], "Bolt options");
  }
});

test("an unsaved optional new-bolt title blocks swipe navigation, but an empty draft does not", () => {
  for (const title of ["", "Unsaved title"]) {
    const html = renderToStaticMarkup(createElement(NewEntryForm, { title }));
    assert.match(html, new RegExp(`data-swipe-home-blocked="${Boolean(title)}"`));
  }
});
