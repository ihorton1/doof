import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DishHeader, type DishHeaderData } from "../src/app/(app)/dishes/[id]/dish-header";
import { DayPicker } from "../src/app/(app)/plan/day-picker";

const dish: DishHeaderData = {
  id: "dish-1", name: "Chilli eggs", description: "A quick dinner", servings: 2,
  sourceUrl: "https://example.com/recipe", imageUrl: "/api/dishes/dish-1/image",
  tags: ["quick", "lyse friendly"],
  rating: null,
};

function render(value = dish) {
  return renderToStaticMarkup(createElement(DishHeader, {
    dish: value,
    todayIso: "2026-12-30",
    tagSuggestions: ["quick", "lyse friendly"],
    addDishAction: async () => ({ status: "added" } as const),
    addTagAction: async ({ tag }) => ({ status: "added", tag } as const),
    setRatingAction: async ({ rating }) => ({ rating }),
  }));
}

test("dish title and photo retain gestures and keyboard alternatives alongside an explicit rating button", () => {
  const html = render();
  assert.match(html, /<h1[^>]*><button[^>]*type="button"[^>]*>Chilli eggs<\/button><\/h1>/);
  assert.match(html, /aria-label="Plan or tag Chilli eggs"/);
  assert.equal((html.match(/aria-keyshortcuts="Enter Space t"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /aria-label="Add to plan"|aria-label="Add a tag"/);
  assert.equal((html.match(/<button\b/g) ?? []).length, 3);
  assert.match(html, /aria-label="Rate Chilli eggs"/);
  assert.match(html, /Double-tap the dish title or photo/);
  assert.match(html, /Triple-tap to add a tag/);
  assert.doesNotMatch(html, /<dialog/);
});

test("header preserves metadata, edit/source/tag links and the recipe image", () => {
  const html = render();
  for (const text of ["A quick dinner", "Serves 2", 'href="/dishes/dish-1/edit"', 'href="https://example.com/recipe"', 'href="/dishes?tag=lyse%20friendly"', 'src="/api/dishes/dish-1/image"']) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /draggable="false"/);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/);
});

test("dishes without photos or metadata retain title gestures and can still be rated", () => {
  const html = render({ ...dish, imageUrl: null, description: null, servings: null, sourceUrl: null, tags: [] });
  assert.doesNotMatch(html, /<img|src="null"|href="null"|>Source<\/a>/);
  assert.equal((html.match(/aria-keyshortcuts="Enter Space t"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /aria-label="Add to plan"|aria-label="Add a tag"/);
  assert.equal((html.match(/<button\b/g) ?? []).length, 2);
});

test("the editable rating leads the tag row, outside the title's planning and tagging button", () => {
  const html = render({ ...dish, rating: "delish" });
  assert.match(html, /aria-label="Change rating for Chilli eggs: delish"/);
  assert.match(html, /aria-label="Rating: delish"/);
  assert.ok(html.indexOf("</h1>") < html.indexOf("data-rating-control"));
  assert.ok(html.indexOf("A quick dinner") < html.indexOf("data-rating-control"));
  assert.match(html, /aria-label="Recipe rating and tags"[^>]*><div data-rating-control/);
  assert.ok(html.indexOf("data-rating-control") < html.indexOf('href="/dishes?tag=quick"'));
});

test("shared day picker accepts a dish summary and retains 30 dates across the year boundary", () => {
  const html = renderToStaticMarkup(createElement(DayPicker, {
    dish: { id: dish.id, name: dish.name },
    todayIso: "2026-12-30",
    addDishAction: async () => ({ status: "added" } as const),
    onClose() {}, onAdded() {},
  }));
  assert.match(html, />Plan Chilli eggs<\/h2>/);
  assert.equal((html.match(/role="option"/g) ?? []).length, 30);
  assert.match(html, /planning-day-2026-12-30/);
  assert.match(html, /planning-day-2027-01-28/);
  assert.match(html, /aria-label="Day to cook"/);
  assert.match(html, /Add to Today/);
});
