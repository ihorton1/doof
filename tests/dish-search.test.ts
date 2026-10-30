import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { filterDishes, getDishSearchSuggestions } from "../src/lib/dish-search";
import { DishList, type DishListItem } from "../src/app/(app)/dishes/dish-list";

const dishes: DishListItem[] = [
  { id: "curry", name: "Chickpea curry", ingredientNames: ["spinach", "garlic"], tags: ["quick", "vegetarian"], description: null, imageUrl: null, status: "Planned today" },
  { id: "pasta", name: "Pasta", ingredientNames: ["chickpeas", "tomato"], tags: ["weeknight"], description: null, imageUrl: null, status: "Never cooked" },
  { id: "soup", name: "Soup", ingredientNames: [], tags: ["chickpea"], description: null, imageUrl: null, status: "Never cooked" },
];

test("one query matches names, ingredients or tags without duplicate results", () => {
  assert.deepEqual(filterDishes(dishes, "chickpea").map(dish => dish.id), ["curry", "pasta", "soup"]);
  assert.deepEqual(filterDishes(dishes, "spinach").map(dish => dish.id), ["curry"]);
  assert.deepEqual(filterDishes(dishes, "weeknight").map(dish => dish.id), ["pasta"]);
  assert.deepEqual(filterDishes([{ ...dishes[0], tags: ["curry"], ingredientNames: ["curry powder"] }], "curry").map(dish => dish.id), ["curry"]);
});

test("search is case-insensitive, trims whitespace and matches substrings", () => {
  assert.deepEqual(filterDishes(dishes, "  WEEK  ").map(dish => dish.id), ["pasta"]);
  assert.equal(filterDishes(dishes, "").length, dishes.length);
  assert.equal(filterDishes(dishes, "   ").length, dishes.length);
  assert.deepEqual(filterDishes(dishes, "not-present"), []);
  assert.deepEqual(filterDishes([], "quick"), []);
});

test("autocomplete includes names, ingredients and tags with trimmed unique values", () => {
  const suggestions = getDishSearchSuggestions([
    dishes[0],
    { ...dishes[1], ingredientNames: [" garlic ", " ", "tomato"], tags: ["quick"] },
  ]);
  for (const value of ["Chickpea curry", "Pasta", "spinach", "garlic", "tomato", "quick", "vegetarian"]) {
    assert.ok(suggestions.includes(value), value);
  }
  assert.equal(suggestions.filter(value => value === "garlic").length, 1);
  assert.ok(!suggestions.includes(""));
});

test("Dishes renders one accessible search without scope toggles", () => {
  const html = renderToStaticMarkup(createElement(DishList, { dishes }));
  assert.match(html, /aria-label="Search dishes, ingredients or tags"/);
  assert.match(html, /placeholder="Search dishes, ingredients or tags\.\.\."/);
  assert.doesNotMatch(html, />Dish names<\/button>|>Ingredients<\/button>/);
  assert.match(html, /<option value="weeknight"/);
});
