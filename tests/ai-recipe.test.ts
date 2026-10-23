import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_RECIPE_PROMPT,
  AiRecipeError,
  MAX_AI_RECIPE_LENGTH,
  parseAiRecipe,
} from "../src/lib/ai-recipe";
import { createIngredientDraft, convertedIngredients } from "../src/lib/ingredient-conversion";

const recipe = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Simple rice",
  recipeIngredient: ["1 cup rice", "2 cups water", "Salt to taste"],
  recipeInstructions: ["Rinse the rice.", "Simmer for 15 minutes.\nRest for 5 minutes."],
};

test("AI recipes preserve ingredient lines and turn ordered cooking steps into Notes", () => {
  const result = parseAiRecipe(JSON.stringify(recipe));
  assert.deepEqual(result, {
    name: "Simple rice",
    ingredients: recipe.recipeIngredient,
    notes: "1. Rinse the rice.\n\n2. Simmer for 15 minutes.\nRest for 5 minutes.",
  });
});

test("accepts raw JSON and common Markdown JSON fences", () => {
  const json = JSON.stringify(recipe, null, 2);
  for (const text of [
    json, ` \n${json}\n `,
    `\`\`\`json\n${json}\n\`\`\``,
    `\`\`\`jsonld\n${json}\n\`\`\``,
    `\`\`\`application/ld+json\r\n${json}\r\n\`\`\``,
    `\`\`\`\n${json}\n\`\`\``,
  ]) {
    assert.equal(parseAiRecipe(text).name, recipe.name);
  }
});

test("rejects empty input, malformed JSON, surrounding prose and multiple recipes", () => {
  for (const text of ["", " ", "{", "Here is your recipe:\n" + JSON.stringify(recipe), JSON.stringify([recipe]), "null"]) {
    assert.throws(() => parseAiRecipe(text), AiRecipeError);
  }
});

test("requires a Recipe with a name, ingredient strings and cooking-step strings", () => {
  for (const [field, value, message] of [
    ["@type", "Article", /@type/],
    ["@context", "https://other.example", /@context/],
    ["name", "", /recipe name/],
    ["name", 12, /recipe name/],
    ["recipeIngredient", [], /ingredient strings/],
    ["recipeIngredient", [" "], /ingredient strings/],
    ["recipeIngredient", [{ name: "rice" }], /ingredient strings/],
    ["recipeInstructions", [], /cooking-step strings/],
    ["recipeInstructions", [" "], /cooking-step strings/],
    ["recipeInstructions", "Simmer.", /cooking-step strings/],
    ["recipeInstructions", [{ "@type": "HowToStep", text: "Simmer." }], /cooking-step strings/],
  ] as const) {
    assert.throws(() => parseAiRecipe(JSON.stringify({ ...recipe, [field]: value })), message);
  }
  for (const field of ["name", "recipeIngredient", "recipeInstructions"]) {
    const without = Object.fromEntries(Object.entries(recipe).filter(([key]) => key !== field));
    assert.throws(() => parseAiRecipe(JSON.stringify(without)), AiRecipeError);
  }
});

test("trims surrounding whitespace without changing measurements or step content", () => {
  const result = parseAiRecipe(JSON.stringify({
    ...recipe,
    name: "  Simple rice  ",
    recipeIngredient: ["  1\u00bd cups rice  ", "200g butter"],
    recipeInstructions: ["  Cook at 180\u00b0C for 20 minutes.  "],
  }));
  assert.equal(result.name, "Simple rice");
  assert.deepEqual(result.ingredients, ["1\u00bd cups rice", "200g butter"]);
  assert.equal(result.notes, "1. Cook at 180\u00b0C for 20 minutes.");
});

test("does not import extra fields or fetch linked image and context resources", () => {
  const result = parseAiRecipe(JSON.stringify({
    ...recipe,
    image: "http://127.0.0.1/private",
    sourceUrl: "https://example.com/recipe",
    recipeYield: "4",
    description: "Not requested",
  }));
  assert.deepEqual(Object.keys(result).sort(), ["ingredients", "name", "notes"]);
});

test("matches the name and ingredient limits without silently truncating", () => {
  const valid = {
    ...recipe,
    name: "a".repeat(200),
    recipeIngredient: ["x".repeat(2000), ...Array.from({ length: 199 }, () => "salt")],
  };
  const result = parseAiRecipe(JSON.stringify(valid));
  assert.equal(result.name.length, 200);
  assert.equal(result.ingredients.length, 200);
  assert.equal(result.ingredients[0].length, 2000);
  assert.throws(() => parseAiRecipe(JSON.stringify({ ...valid, name: "a".repeat(201) })), /recipe name/);
  assert.throws(() => parseAiRecipe(JSON.stringify({ ...valid, recipeIngredient: ["x".repeat(2001)] })), /ingredient strings/);
  assert.throws(() => parseAiRecipe(JSON.stringify({ ...valid, recipeIngredient: [...valid.recipeIngredient, "salt"] })), /ingredient strings/);
});

test("counts numbering and separators against the Notes limit", () => {
  assert.equal(parseAiRecipe(JSON.stringify({ ...recipe, recipeInstructions: ["x".repeat(19997)] })).notes.length, 20000);
  assert.throws(() => parseAiRecipe(JSON.stringify({ ...recipe, recipeInstructions: ["x".repeat(19998)] })), /Notes limit/);
  assert.throws(() => parseAiRecipe(JSON.stringify({ ...recipe, recipeInstructions: ["x".repeat(10000), "y".repeat(10000)] })), /Notes limit/);
  assert.equal(parseAiRecipe(JSON.stringify({ ...recipe, recipeInstructions: Array.from({ length: 200 }, () => "Stir.") })).notes.split("\n\n").length, 200);
  assert.throws(() => parseAiRecipe(JSON.stringify({ ...recipe, recipeInstructions: Array.from({ length: 201 }, () => "Stir.") })), /cooking-step strings/);
});

test("enforces the complete response limit before parsing", () => {
  const json = JSON.stringify(recipe);
  assert.equal(parseAiRecipe(json.padEnd(MAX_AI_RECIPE_LENGTH, " ")).name, recipe.name);
  assert.throws(() => parseAiRecipe(json.padEnd(MAX_AI_RECIPE_LENGTH + 1, " ")), /100,000/);
});

test("stored prompt example is valid and describes the accepted fields", () => {
  const example = AI_RECIPE_PROMPT.slice(AI_RECIPE_PROMPT.indexOf("{"), AI_RECIPE_PROMPT.indexOf("}") + 1);
  assert.ok(parseAiRecipe(example).notes);
  assert.match(AI_RECIPE_PROMPT, /Do not invent missing details/);
  assert.match(AI_RECIPE_PROMPT, /1-200 cooking steps/);
});

test("AI ingredient lines enter the same manual conversion workflow", () => {
  const result = parseAiRecipe(JSON.stringify(recipe));
  const drafts = result.ingredients.map(createIngredientDraft);
  assert.ok(drafts.every((draft) => draft.name === "" && draft.quantity === "" && draft.unit === ""));
  assert.throws(() => convertedIngredients(drafts), /Finish preparing/);
  assert.deepEqual(convertedIngredients([
    { ...drafts[0], name: "rice", quantity: "1", unit: "cup" },
    { ...drafts[1], name: "water", quantity: "2", unit: "cups" },
    { ...drafts[2], included: false },
  ]), [
    { name: "rice", quantity: "1", unit: "cup" },
    { name: "water", quantity: "2", unit: "cups" },
  ]);
});
