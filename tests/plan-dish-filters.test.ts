import assert from "node:assert/strict";
import { test } from "node:test";
import { filterPlanDishes, type PlanFilter } from "../src/lib/plan-dish-filters";

const include = (...values: string[]): PlanFilter[] => values.map(value => ({ value, exclude: false }));
const exclude = (...values: string[]): PlanFilter[] => values.map(value => ({ value, exclude: true }));

const dishes = [
  { id: "curry", name: "Chickpea curry", ingredientNames: ["spinach", "garlic"], tags: ["quick", "vegetarian"] },
  { id: "pasta", name: "Pasta", ingredientNames: ["chickpeas", "tomato"], tags: ["quick", "weeknight"] },
  { id: "soup", name: "Soup", ingredientNames: ["garlic"], tags: ["chickpea", "weeknight"] },
  { id: "bread", name: "Bread", ingredientNames: [], tags: [] },
];

test("each ad hoc filter matches a title, ingredient or tag", () => {
  assert.deepEqual(filterPlanDishes(dishes, [], include("chickpea")).map(dish => dish.id), ["curry", "pasta", "soup"]);
});

test("every ad hoc filter and every selected recipe tag must match", () => {
  assert.deepEqual(filterPlanDishes(dishes, include("weeknight"), include("chickpea")).map(dish => dish.id), ["pasta", "soup"]);
  assert.deepEqual(filterPlanDishes(dishes, include("weeknight"), include("chickpea", "garlic")).map(dish => dish.id), ["soup"]);
  assert.deepEqual(filterPlanDishes(dishes, include("weeknight"), include("chickpea", "garlic", "tomato")), []);
  assert.deepEqual(filterPlanDishes(dishes, include("quick", "vegetarian"), []).map(dish => dish.id), ["curry"]);
  assert.deepEqual(filterPlanDishes(dishes, include("quick", "weeknight"), []).map(dish => dish.id), ["pasta"]);
});

test("query chips trim whitespace and ignore case while supporting substring matches", () => {
  assert.deepEqual(filterPlanDishes(dishes, [], include("  CHICK  ", "  QUICK ")).map(dish => dish.id), ["curry", "pasta"]);
  assert.deepEqual(filterPlanDishes(dishes, [], include("gar", "CUR")).map(dish => dish.id), ["curry"]);
});

test("clearing queries or tags independently restores the appropriate recipes", () => {
  assert.deepEqual(filterPlanDishes(dishes, include("weeknight"), []).map(dish => dish.id), ["pasta", "soup"]);
  assert.deepEqual(filterPlanDishes(dishes, [], include("garlic")).map(dish => dish.id), ["curry", "soup"]);
  assert.deepEqual(filterPlanDishes(dishes, [], []), dishes);
  assert.deepEqual(filterPlanDishes([], [], include("chickpea")), []);
  assert.deepEqual(filterPlanDishes(dishes, include("not-present"), []), []);
});

test("filters preserve recommendation order, metadata and their inputs", () => {
  const ranked = [dishes[2], dishes[1], dishes[0]];
  const before = structuredClone(ranked);
  const queries = include("chickpea", "quick");
  const matches = filterPlanDishes(ranked, [], queries);
  assert.deepEqual(matches.map(dish => dish.id), ["pasta", "curry"]);
  assert.equal(matches[0], ranked[1]);
  assert.deepEqual(ranked, before);
  assert.deepEqual(queries, include("chickpea", "quick"));
});

test("multiple excluded tags combine with positive tags using AND", () => {
  assert.deepEqual(filterPlanDishes(dishes, [
    ...include("quick"), ...exclude("vegetarian", "chickpea"),
  ], []).map(dish => dish.id), ["pasta"]);
  assert.deepEqual(filterPlanDishes(dishes, exclude("quick", "weeknight"), []).map(dish => dish.id), ["bread"]);
});

test("excluded custom filters match names, ingredients and tags with the same substring rules", () => {
  assert.deepEqual(filterPlanDishes(dishes, [], exclude(" CUR ")).map(dish => dish.id), ["pasta", "soup", "bread"]);
  assert.deepEqual(filterPlanDishes(dishes, [], exclude(" GAR ")).map(dish => dish.id), ["pasta", "bread"]);
  assert.deepEqual(filterPlanDishes(dishes, [], exclude(" WEEKN ")).map(dish => dish.id), ["curry", "bread"]);
});

test("positive and negative filters across tags and custom queries are all ANDed", () => {
  assert.deepEqual(filterPlanDishes(dishes, [
    ...include("quick"), ...exclude("vegetarian"),
  ], [...include("CHICK"), ...exclude("garlic", "CUR")]).map(dish => dish.id), ["pasta"]);
  assert.deepEqual(filterPlanDishes(dishes, include("quick"), exclude("garlic", "tomato")), []);
});

test("contradictory filters produce no matches, and missing exclusions retain recipes", () => {
  assert.deepEqual(filterPlanDishes(dishes, [...include("quick"), ...exclude("quick")], []), []);
  assert.deepEqual(filterPlanDishes(dishes, [], [...include("garlic"), ...exclude("garlic")]), []);
  assert.deepEqual(filterPlanDishes(dishes, exclude("not-present"), exclude("not-present")), dishes);
});

test("exclusions retain recommendation order and do not mutate filters or dishes", () => {
  const ranked = [dishes[2], dishes[1], dishes[3], dishes[0]];
  const tags = exclude("vegetarian");
  const queries = exclude("garlic");
  const before = structuredClone({ ranked, tags, queries });
  const matches = filterPlanDishes(ranked, tags, queries);
  assert.deepEqual(matches.map(dish => dish.id), ["pasta", "bread"]);
  assert.equal(matches[0], ranked[1]);
  assert.deepEqual({ ranked, tags, queries }, before);
});
