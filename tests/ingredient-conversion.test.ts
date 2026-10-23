import assert from "node:assert/strict";
import { test } from "node:test";
import {
  convertedIngredients,
  createIngredientDraft,
  ingredientDraftError,
  ingredientWords,
  selectedWords,
} from "../src/lib/ingredient-conversion";

test("drafts retain the original sentence without guessing any fields", () => {
  assert.deepEqual(createIngredientDraft("2 x 400g tins tomatoes"), {
    original: "2 x 400g tins tomatoes", name: "", quantity: "", unit: "",
  });
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
  assert.throws(() => convertedIngredients([createIngredientDraft("200 g flour")]), /at least one/);
  assert.throws(() => convertedIngredients([{ ...createIngredientDraft("salt"), name: " " }]), /at least one/);
  assert.throws(() => convertedIngredients([]), /at least one/);
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
