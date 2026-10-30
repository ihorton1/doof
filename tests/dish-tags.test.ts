import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dishTagSchema, getTagOptions, MAX_TAG_LENGTH, normalizeTag } from "../src/lib/dish-tags";
import { TagPicker } from "../src/app/(app)/dishes/tag-picker";
import { QuickTagPicker } from "../src/app/(app)/plan/quick-tag-picker";

test("tag normalization preserves the dish editor's trimmed lowercase 40-character convention", () => {
  assert.equal(MAX_TAG_LENGTH, 40);
  assert.equal(normalizeTag("  WeekNight  "), "weeknight");
  assert.equal(normalizeTag("   "), "");
  assert.equal(normalizeTag("X".repeat(41)), "x".repeat(40));
});

test("quick tag input requires a dish and one nonblank tag no longer than 40 characters", () => {
  assert.deepEqual(dishTagSchema.parse({ dishId: "dish-1", tag: "  Quick Dinner  " }), {
    dishId: "dish-1", tag: "quick dinner",
  });
  assert.equal(dishTagSchema.safeParse({ dishId: "dish-1", tag: "x".repeat(40) }).success, true);
  for (const input of [
    { dishId: "", tag: "quick" },
    { dishId: "x".repeat(101), tag: "quick" },
    { dishId: "dish-1", tag: "" },
    { dishId: "dish-1", tag: "   " },
    { dishId: "dish-1", tag: "x".repeat(41) },
    { dishId: "dish-1", tag: null },
    { dishId: "dish-1", tag: 123 },
  ]) {
    assert.equal(dishTagSchema.safeParse(input).success, false);
  }
});

test("quick tagging has an accessible compact dialog with custom tag autocomplete", () => {
  const html = renderToStaticMarkup(createElement(QuickTagPicker, {
    dish: { id: "dish-1", name: "Chilli eggs", tags: ["quick"] },
    suggestions: ["quick", "vegetarian", "weeknight"],
    addTagAction: async ({ tag }) => ({ status: "added" as const, tag }),
    onClose() {},
    onAdded() {},
  }));
  assert.match(html, /aria-labelledby="quick-tag-title"/);
  assert.match(html, /Tag Chilli eggs/);
  assert.match(html, /aria-label="Close tag picker"/);
  assert.match(html, /aria-label="Tag name"/);
  assert.match(html, /maxLength="40"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /<datalist|<option/);
  assert.match(html, />Add tag<\/button>/);
});

test("tag autocomplete matches substrings, excludes assigned tags, and offers creation", () => {
  assert.deepEqual(getTagOptions("  WEEK  ", ["weekend", "weeknight", "quick"], ["weekend"]), [
    { value: "weeknight", create: false },
    { value: "week", create: true },
  ]);
  assert.deepEqual(getTagOptions("weeknight", ["weeknight"], []), [{ value: "weeknight", create: false }]);
  assert.deepEqual(getTagOptions("weeknight", ["weeknight"], ["weeknight"]), []);
  assert.deepEqual(getTagOptions("   ", ["weeknight"], []), []);
  assert.deepEqual(getTagOptions("New tag", [], []), [{ value: "new tag", create: true }]);
  const suggestions = Array.from({ length: 10 }, (_, index) => `tag ${index}`);
  const options = getTagOptions("tag", suggestions, []);
  assert.equal(options.filter(option => !option.create).length, 8);
  assert.equal(options.length, 9);
});

test("the dish editor uses the same accessible tag autocomplete and preserves saved tag inputs", () => {
  const html = renderToStaticMarkup(createElement(TagPicker, {
    initial: ["quick"], suggestions: ["quick", "weeknight"],
  }));
  assert.match(html, /name="tag" value="quick"/);
  assert.match(html, /aria-label="Remove quick"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-label="Add tags"/);
});
