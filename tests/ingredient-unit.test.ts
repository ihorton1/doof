import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeIngredientUnit } from "../src/lib/ingredient-unit";

test("normalizes the production unit variants to short recognizable forms", () => {
  for (const [input, expected] of [
    ["cups", "cup"],
    ["cloves", "clove"],
    ["lbs", "lb"],
    ["inch", "in"],
    ["tins", "tin"],
    ["ounces", "oz"],
    ["ltrs", "l"],
    ["teaspoon", "tsp"],
  ]) {
    assert.equal(normalizeIngredientUnit(input), expected, input);
  }
});

test("recognizes common measurement spellings, plurals, case and abbreviation periods", () => {
  for (const [expected, aliases] of [
    ["tbsp", ["tbsp", "tbs", "tbsps", "tablespoon", "tablespoons"]],
    ["tsp", ["tsp", "tsps", "teaspoon", "teaspoons"]],
    ["g", ["g", "gram", "grams", "gramme", "grammes"]],
    ["kg", ["kg", "kgs", "kilogram", "kilograms", "kilogramme", "kilogrammes"]],
    ["mg", ["mg", "milligram", "milligrams", "milligramme", "milligrammes"]],
    ["ml", ["ml", "mls", "milliliter", "milliliters", "millilitre", "millilitres"]],
    ["l", ["l", "lt", "ltr", "ltrs", "liter", "liters", "litre", "litres"]],
    ["oz", ["oz", "ounce", "ounces"]],
    ["lb", ["lb", "lbs", "pound", "pounds"]],
    ["in", ["in", "inch", "inches"]],
    ["cm", ["cm", "cms", "centimeter", "centimeters", "centimetre", "centimetres"]],
    ["mm", ["mm", "mms", "millimeter", "millimeters", "millimetre", "millimetres"]],
    ["cup", ["cup", "cups"]],
    ["clove", ["clove", "cloves"]],
    ["tin", ["tin", "tins"]],
  ] as const) {
    for (const alias of aliases) {
      for (const input of [alias, ` \t${alias.toUpperCase()} \n`, `${alias}.`]) {
        assert.equal(normalizeIngredientUnit(input), expected, input);
        assert.equal(normalizeIngredientUnit(normalizeIngredientUnit(input)!), expected);
      }
    }
  }
});

test("preserves descriptive, unknown and qualified units without guessing", () => {
  for (const input of [
    "can", "bunch", "pack", "basket", "fillet", "head", "pint",
    "fl oz", "us cups", "heaped tablespoons", "400g tins", "t", "custom.",
    "constructor", "__proto__",
  ]) {
    assert.equal(normalizeIngredientUnit(` ${input.toUpperCase()} `), input);
  }
});

test("stores absent or whitespace-only units as null", () => {
  for (const input of ["", " ", "\t\n"]) {
    assert.equal(normalizeIngredientUnit(input), null);
  }
});
