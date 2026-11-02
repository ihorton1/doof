import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilterBubble } from "../src/app/(app)/plan/filter-bubble";

function render(active: boolean, excluded: boolean, removable = false) {
  return renderToStaticMarkup(createElement(FilterBubble, {
    value: "slow cooker", active, excluded, removable, resetVersion: 0,
    onActivate() {}, onExclude() {},
  }));
}

test("tag bubbles expose inactive, positive and negative modes without relying only on colour", () => {
  assert.match(render(false, false), /aria-pressed="false"/);
  assert.match(render(true, false), /data-filter-mode="include"/);
  const negative = render(true, true);
  assert.match(negative, /aria-pressed="true"/);
  assert.match(negative, /aria-describedby="plan-filter-help [^"]+"/);
  assert.match(negative, /class="sr-only">Excludes matching recipes\.<\/span>/);
  assert.match(negative, /data-filter-mode="exclude"/);
  assert.match(negative, /bg-red-600/);
  assert.match(negative, /lucide-minus/);
  assert.match(negative, /aria-keyshortcuts="n"/);
  assert.match(negative, /touch-manipulation select-none/);
});

test("custom exclusions remain clearly named removable buttons", () => {
  const html = render(true, true, true);
  assert.match(html, /aria-label="Remove excluded filter slow cooker"/);
  assert.match(html, /lucide-x/);
  assert.doesNotMatch(html, /aria-pressed=/);
  assert.match(html, /type="button"/);
});
