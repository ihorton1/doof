import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MostCookedMeals } from "../src/app/(app)/plan/most-cooked-meals";
import { getMostPlannedDishes } from "../src/lib/plan-recommendations";

test("Most cooked shows recipe links, saved thumbnails and correctly pluralized plan counts", () => {
  const html = renderToStaticMarkup(createElement(MostCookedMeals, {
    dishes: [
      { id: "soup", name: "Soup", imageUrl: "/api/dishes/soup/image?v=123", planCount: 12, rating: "delish" },
      { id: "pasta", name: "Pasta", imageUrl: null, planCount: 1, rating: null },
    ],
  }));
  assert.match(html, /aria-labelledby="most-cooked-heading"/);
  assert.match(html, /<h2[^>]*>Most cooked<\/h2>/);
  assert.match(html, /<ol/);
  assert.match(html, /href="\/dishes\/soup"/);
  assert.match(html, /href="\/dishes\/pasta"/);
  assert.match(html, /src="\/api\/dishes\/soup\/image\?v=123" alt="" width="56" height="56" loading="lazy"/);
  assert.match(html, /lucide-utensils-crossed/);
  assert.match(html, /aria-label="Added to plan 12 times"/);
  assert.match(html, /aria-label="Added to plan 1 time"/);
  assert.doesNotMatch(html, /1 times|src="null"|<button/);
  assert.equal((html.match(/aria-label="Rating:/g) ?? []).length, 1);
  assert.match(html, /aria-label="Rating: delish"/);
  assert.ok(html.indexOf('href="/dishes/soup"') < html.indexOf('href="/dishes/pasta"'));
});

test("only the top ten planned saved meals are rendered", () => {
  const recipes = Array.from({ length: 12 }, (_, index) => ({
    id: `dish-${index}`, name: `Meal ${index}`, imageUrl: null, rating: null,
  }));
  const history = recipes.flatMap((dish, index) =>
    Array.from({ length: index + 1 }, () => ({ dishId: dish.id })),
  );
  const html = renderToStaticMarkup(createElement(MostCookedMeals, {
    dishes: getMostPlannedDishes(recipes, history),
  }));
  assert.equal((html.match(/<li>/g) ?? []).length, 10);
  assert.match(html, /href="\/dishes\/dish-11"/);
  assert.doesNotMatch(html, /href="\/dishes\/dish-(?:0|1)"/);
});

test("Most cooked remains visible with guidance when no meals have been planned", () => {
  const html = renderToStaticMarkup(createElement(MostCookedMeals, { dishes: [] }));
  assert.match(html, /Most cooked/);
  assert.match(html, /Add meals to your plan/);
  assert.doesNotMatch(html, /<ol|<img|href=/);
});
