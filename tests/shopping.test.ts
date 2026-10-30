import assert from "node:assert/strict";
import { test } from "node:test";
import { buildShoppingRows, groupShoppingItems, ingredientKey, type ShoppingItem } from "../src/lib/shopping";

const ingredient = { name: " Carrot ", quantity: "2", unit: " kg " };
const dish = { id: "dish-a", name: "Curry", ingredients: [ingredient] };
const item: ShoppingItem = {
  id: "item-a", name: "Carrot", quantity: "2", unit: "kg", category: "Curry",
  dishId: "dish-a", source: "auto", checked: false,
};

test("repeated planned dishes sum quantities without duplicate ingredient rows", () => {
  assert.deepEqual(buildShoppingRows([dish, dish]), [{
    name: "Carrot", quantity: "4", unit: "kg", category: "Curry", dishId: "dish-a",
  }]);
});

test("same ingredients in different dishes remain independently checkable", () => {
  const rows = buildShoppingRows([dish, { ...dish, id: "dish-b", name: "Soup" }]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.category), ["Curry", "Soup"]);
  assert.deepEqual(rows.map((row) => row.quantity), ["2", "2"]);
});

test("quantities preserve blanks, descriptive values and incompatible units", () => {
  const rows = buildShoppingRows([{
    ...dish, ingredients: [
      { ...ingredient, quantity: null }, { ...ingredient, quantity: "a handful" },
      { ...ingredient, quantity: "1/2" }, { ...ingredient, unit: "g", quantity: "100" },
      { ...ingredient, unit: null, quantity: null },
    ],
  }]);
  assert.deepEqual(rows.map((row) => [row.unit, row.quantity]), [
    ["kg", "a handful + 1/2"], ["g", "100"], [null, null],
  ]);
});

test("ingredient identity trims names/units, ignores name casing and avoids delimiter collisions", () => {
  assert.equal(ingredientKey(item), ingredientKey({ ...item, name: " CARROT ", unit: " kg " }));
  assert.notEqual(ingredientKey({ name: "a|b", unit: "c", dishId: null }),
    ingredientKey({ name: "a", unit: "b|c", dishId: null }));
});

test("dish grouping is alphabetical, places extras last and does not mutate stored items", () => {
  const items = [item, { ...item, id: "item-b", category: "Apple soup", dishId: "dish-b" },
    { ...item, id: "manual", source: "manual", category: "produce", dishId: null }];
  const original = structuredClone(items);
  const groups = groupShoppingItems(items, "dish");
  assert.deepEqual(groups.map((group) => group.cat), ["Apple soup", "Curry", "Extras"]);
  assert.deepEqual(groups[1].items[0].ids, ["item-a"]);
  assert.deepEqual(items, original);
});

test("aisle grouping combines quantities and retains every source id with mixed checked state", () => {
  const items = [item, { ...item, id: "item-b", dishId: "dish-b", quantity: "3", checked: true }];
  const [group] = groupShoppingItems(items, "aisle");
  assert.equal(group.cat, "produce");
  assert.equal(group.items.length, 1);
  assert.deepEqual(group.items[0].ids, ["item-a", "item-b"]);
  assert.equal(group.items[0].quantity, "5");
  assert.equal(group.items[0].checked, false);
  assert.equal(group.items[0].someChecked, true);
  assert.equal(groupShoppingItems(items.map((entry) => ({ ...entry, checked: true })), "aisle")[0].items[0].checked, true);
});

test("switching grouping preserves canonical item identities, quantities and checked flags", () => {
  const items = [item, { ...item, id: "item-b", dishId: "dish-b", category: "Soup", checked: true }];
  const before = structuredClone(items);
  const first = groupShoppingItems(items, "dish");
  groupShoppingItems(items, "aisle");
  assert.deepEqual(groupShoppingItems(items, "dish"), first);
  assert.deepEqual(items, before);
});

test("aisle view orders known categories and does not merge manual extras into generated rows", () => {
  const groups = groupShoppingItems([
    { ...item, id: "rice", name: "Rice", unit: null },
    { ...item, id: "other", name: "Detergent", unit: null },
    item, { ...item, id: "manual", source: "manual", dishId: null },
    { ...item, id: "grams", unit: "g" },
  ], "aisle");
  assert.deepEqual(groups.map((group) => group.cat), ["produce", "pantry", "other"]);
  assert.equal(groups[0].items.length, 3);
});

test("same-named dishes and a recipe called Extras retain independent groups", () => {
  const groups = groupShoppingItems([
    { ...item, category: "Extras" },
    { ...item, id: "item-b", dishId: "dish-b", category: "Extras" },
    { ...item, id: "manual", dishId: null, source: "manual" },
  ], "dish");
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.map((group) => group.key)).size, 3);
  assert.equal(groups.at(-1)?.key, "manual");
});
