import assert from "node:assert/strict";
import { test } from "node:test";
import {
  convertedIngredients,
  createIngredientDraft,
  ingredientDraftError,
  ingredientWords,
  selectedWords,
} from "../src/lib/ingredient-conversion";

test("ambiguous packaging retains the original sentence without guessing measurements", () => {
  assert.deepEqual(createIngredientDraft("2 x 400g tins tomatoes"), {
    original: "2 x 400g tins tomatoes", name: "2 x 400g tins tomatoes", quantity: "", unit: "",
  });
});

test("prefills straightforward measurements while preserving the original text and unit spelling", () => {
  for (const [original, quantity, unit, name] of [
    ["2 tablespoons olive oil", "2", "tablespoons", "olive oil"],
    ["200g all-purpose flour", "200", "g", "all-purpose flour"],
    ["1 1/2 cups plain flour", "1 1/2", "cups", "plain flour"],
    ["1\u00bd cups rice", "1\u00bd", "cups", "rice"],
    ["\u00bc teaspoon salt", "\u00bc", "teaspoon", "salt"],
    ["1 \u00bd cups rice", "1 \u00bd", "cups", "rice"],
    ["1\u20442 cup water", "1\u20442", "cup", "water"],
    ["0.5 l milk", "0.5", "l", "milk"],
    [".5 tsp. salt", ".5", "tsp.", "salt"],
    ["1,5 litres stock", "1,5", "litres", "stock"],
    ["2-3 cloves garlic", "2-3", "cloves", "garlic"],
    ["1 1/2\u20132 cups water", "1 1/2\u20132", "cups", "water"],
    ["1 to 2 tbsp olive oil", "1 to 2", "tbsp", "olive oil"],
    ["2 large onions", "2", "", "large onions"],
    ["1 egg", "1", "", "egg"],
    ["2 heaped tablespoons of flour", "2", "heaped tablespoons", "flour"],
    ["3 fl. oz. milk", "3", "fl. oz.", "milk"],
    ["2 fluid ounces water", "2", "fluid ounces", "water"],
    ["2 pinches salt", "2", "pinches", "salt"],
    ["  \u2022 2 TBSP olive oil  ", "2", "TBSP", "olive oil"],
    ["2 mystery-scoops flour", "2", "", "mystery-scoops flour"],
    ["olive oil, for frying", "", "", "olive oil, for frying"],
  ]) {
    assert.deepEqual(createIngredientDraft(original), { original, quantity, unit, name }, original);
  }
});

test("uncertain alternative measurements are not discarded and headings remain omitted", () => {
  for (const original of [
    "1 (400 g) can tomatoes", "\u00bc cup/57 grams butter", "200g/7oz flour",
    "1 cup (200g) rice", "2 x 400g tins tomatoes", "2\u00d7400g tins tomatoes",
    "7up", "2% milk", "200 g",
  ]) {
    assert.deepEqual(createIngredientDraft(original), { original, name: original, quantity: "", unit: "" }, original);
  }
  for (const original of ["For the sauce:", "For the dressing", "Topping:"]) {
    assert.deepEqual(createIngredientDraft(original), { original, name: "", quantity: "", unit: "" });
  }
});

test("selected words use sentence order, including non-contiguous and repeated words", () => {
  const sentence = "1 1/2 cups plain flour";
  assert.equal(selectedWords(sentence, [4, 3]), "plain flour");
  assert.equal(selectedWords(sentence, [1, 0]), "1 1/2");
  assert.equal(selectedWords("salt and pepper and oil", [4, 1]), "and oil");
  assert.equal(selectedWords(sentence, []), "");
});

test("separates website-specific attached measurements without changing the original sentence", () => {
  const sentence = "\u00bc cup/57 grams salted butter, softened";
  const words = ingredientWords(sentence);
  assert.deepEqual(words.map((word) => word.text), ["\u00bc", "cup", "/", "57", "grams", "salted", "butter", ",", "softened"]);
  assert.equal(selectedWords(sentence, [3]), "57");
  assert.equal(selectedWords(sentence, [5, 6]), "salted butter");
  assert.equal(selectedWords(sentence, words.map((_, index) => index)), sentence);
  assert.deepEqual(ingredientWords("200g all-purpose flour").map((word) => word.text), ["200", "g", "all-purpose", "flour"]);
  assert.equal(selectedWords("1 1/2-2 cups", [0, 1, 2, 3]), "1 1/2-2");
});

test("conversion trims input, skips unnamed rows even with measurements, and preserves order", () => {
  const drafts = [
    { ...createIngredientDraft("200 g flour"), quantity: " 200 ", unit: " g ", name: " flour " },
    createIngredientDraft("For the sauce:"),
    { ...createIngredientDraft("2 cups water"), name: " \t ", quantity: "2", unit: "cups" },
    { ...createIngredientDraft("salt, to taste"), name: "salt" },
  ];
  const before = structuredClone(drafts);
  assert.deepEqual(convertedIngredients(drafts), [
    { name: "flour", quantity: "200", unit: "g" },
    { name: "salt", quantity: "", unit: "" },
  ]);
  assert.deepEqual(drafts, before);
});

test("entirely unnamed conversions cannot replace existing ingredients", () => {
  assert.throws(() => convertedIngredients([{ ...createIngredientDraft("200 g flour"), name: "" }]), /at least one/);
  assert.throws(() => convertedIngredients([{ ...createIngredientDraft("salt"), name: " " }]), /at least one/);
  assert.throws(() => convertedIngredients([]), /at least one/);
});

test("dismissal excludes a prepared row without losing edits, and undo restores it in order", () => {
  const drafts = ["2 tablespoons olive oil", "1 cup rice", "Salt to taste"].map(createIngredientDraft);
  drafts[1] = { ...drafts[1], quantity: "1 1/2", dismissed: true };
  assert.deepEqual(convertedIngredients(drafts), [
    { name: "olive oil", quantity: "2", unit: "tablespoons" },
    { name: "Salt to taste", quantity: "", unit: "" },
  ]);
  drafts[1].dismissed = false;
  assert.deepEqual(convertedIngredients(drafts)[1], { name: "rice", quantity: "1 1/2", unit: "cup" });
  assert.equal(drafts[1].original, "1 cup rice");
  assert.throws(() => convertedIngredients(drafts.map(draft => ({ ...draft, dismissed: true }))), /at least one/);
  const invalid = { ...drafts[0], unit: "x".repeat(51), dismissed: true };
  assert.equal(ingredientDraftError(invalid), null);
  assert.throws(() => convertedIngredients([{ ...invalid, dismissed: false }]), /Finish preparing/);
});

test("clearing a name omits that row and ignores its unused measurement errors", () => {
  const drafts = [
    { ...createIngredientDraft("flour"), name: "flour" },
    { ...createIngredientDraft("salt"), name: "salt", unit: "x".repeat(51) },
  ];
  assert.throws(() => convertedIngredients(drafts), /Finish preparing/);
  drafts[1].name = "";
  assert.equal(ingredientDraftError(drafts[1]), null);
  assert.deepEqual(convertedIngredients(drafts), [{ name: "flour", quantity: "", unit: "" }]);
});

test("field lengths match the dish-save constraints", () => {
  const draft = { ...createIngredientDraft("original"), name: "a".repeat(200), quantity: "b".repeat(50), unit: "c".repeat(50) };
  assert.equal(ingredientDraftError(draft), null);
  assert.match(ingredientDraftError({ ...draft, name: draft.name + "a" })!, /200/);
  assert.match(ingredientDraftError({ ...draft, quantity: draft.quantity + "b" })!, /50/);
  assert.match(ingredientDraftError({ ...draft, unit: draft.unit + "c" })!, /50/);
  assert.equal(ingredientDraftError({ ...draft, name: " " }), null);
});
