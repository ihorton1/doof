import assert from "node:assert/strict";
import { test } from "node:test";
import { filterPlanDishes } from "../src/lib/plan-dish-filters";

const dishes = [
  { id: "curry", name: "Chickpea curry", ingredientNames: ["spinach", "garlic"], tags: ["quick", "vegetarian"] },
  { id: "pasta", name: "Pasta", ingredientNames: ["chickpeas", "tomato"], tags: ["quick", "weeknight"] },
  { id: "soup", name: "Soup", ingredientNames: ["garlic"], tags: ["chickpea", "weeknight"] },
  { id: "bread", name: "Bread", ingredientNames: [], tags: [] },
];

test("each ad hoc filter matches a title, ingredient or tag", () => {
  assert.deepEqual(filterPlanDishes(dishes, null, ["chickpea"]).map(dish => dish.id), ["curry", "pasta", "soup"]);
});

test("every ad hoc filter and the selected recipe tag must match", () => {
  assert.deepEqual(filterPlanDishes(dishes, "weeknight", ["chickpea"]).map(dish => dish.id), ["pasta", "soup"]);
  assert.deepEqual(filterPlanDishes(dishes, "weeknight", ["chickpea", "garlic"]).map(dish => dish.id), ["soup"]);
  assert.deepEqual(filterPlanDishes(dishes, "weeknight", ["chickpea", "garlic", "tomato"]), []);
});

test("query chips trim whitespace and ignore case while supporting substring matches", () => {
  assert.deepEqual(filterPlanDishes(dishes, null, ["  CHICK  ", "  QUICK "]).map(dish => dish.id), ["curry", "pasta"]);
  assert.deepEqual(filterPlanDishes(dishes, null, ["gar", "CUR"]).map(dish => dish.id), ["curry"]);
});

test("clearing queries or tags independently restores the appropriate recipes", () => {
  assert.deepEqual(filterPlanDishes(dishes, "weeknight", []).map(dish => dish.id), ["pasta", "soup"]);
  assert.deepEqual(filterPlanDishes(dishes, null, ["garlic"]).map(dish => dish.id), ["curry", "soup"]);
  assert.deepEqual(filterPlanDishes(dishes, null, []), dishes);
  assert.deepEqual(filterPlanDishes([], null, ["chickpea"]), []);
  assert.deepEqual(filterPlanDishes(dishes, "not-present", []), []);
});

test("filters preserve recommendation order, metadata and their inputs", () => {
  const ranked = [dishes[2], dishes[1], dishes[0]];
  const before = structuredClone(ranked);
  const queries = ["chickpea", "quick"];
  const matches = filterPlanDishes(ranked, null, queries);
  assert.deepEqual(matches.map(dish => dish.id), ["pasta", "curry"]);
  assert.equal(matches[0], ranked[1]);
  assert.deepEqual(ranked, before);
  assert.deepEqual(queries, ["chickpea", "quick"]);
});
