import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { RecipeCarousel, type SavedDish } from "../src/app/(app)/plan/recipe-carousel";

const dish: SavedDish = {
  id: "dish-1", name: "Chilli eggs", description: "A quick dinner",
  imageUrl: "/api/dishes/dish-1/image", tags: ["quick", "vegetarian"],
};

function render(dishes: SavedDish[]) {
  const carousel = createElement(RecipeCarousel, {
    dishes, todayIso: "2026-10-30",
    addDishAction: async () => ({ status: "added" } as const),
  });
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: {
      back() {}, forward() {}, refresh() {},
      push() {}, replace() {}, prefetch() {},
    },
  }, carousel));
}

test("saved dishes render as snap carousel cards with accessible alternatives to double tap", () => {
  const html = render([dish, { ...dish, id: "dish-2", name: "Soup", imageUrl: null, tags: [] }]);
  assert.match(html, /aria-roledescription="carousel"/);
  assert.match(html, /snap-x snap-mandatory/);
  assert.equal((html.match(/aria-roledescription="slide"/g) ?? []).length, 2);
  assert.match(html, /Chilli eggs/);
  assert.match(html, /aria-label="Recipe tags"/);
  assert.match(html, /href="\/dishes\/dish-1"/);
  assert.doesNotMatch(html, />Choose day<\/button>|>View recipe<\/a>/);
  assert.equal((html.match(/aria-keyshortcuts="Space"/g) ?? []).length, 2);
  assert.match(html, /Enter views the recipe; Space chooses a day/);
  assert.doesNotMatch(html, /aria-label="(?:Previous|Next) recipe"/);
  assert.doesNotMatch(html, />1<!-- --> \/ /);
  assert.doesNotMatch(html, /border-emerald|outline-emerald/);
  assert.doesNotMatch(html, /src="null"/);
});

test("empty saved dishes link to dish creation without an empty carousel", () => {
  const html = render([]);
  assert.match(html, /href="\/dishes\/new"/);
  assert.match(html, /Save a dish first/);
  assert.doesNotMatch(html, /aria-roledescription="carousel"/);
});

test("Plan offers available tags once, alphabetically, with no tag selected initially", () => {
  const html = render([dish, { ...dish, id: "dish-2", tags: ["quick", "weeknight"] }]);
  assert.match(html, /aria-label="Filter recipes by tag"/);
  const buttons = [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]+)<\/button>/g)];
  assert.deepEqual(buttons.map(([, pressed, label]) => ({ pressed, label })), [
    { pressed: "false", label: "quick" },
    { pressed: "false", label: "vegetarian" },
    { pressed: "false", label: "weeknight" },
  ]);
});

test("Plan does not show empty tag controls when no recipes have tags", () => {
  assert.doesNotMatch(render([{ ...dish, tags: [] }]), /aria-label="Filter recipes by tag"/);
  assert.doesNotMatch(render([]), /aria-label="Filter recipes by tag"/);
});
