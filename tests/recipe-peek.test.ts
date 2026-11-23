import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { extractRecipes } from "../src/lib/recipe-import";
import { recipePeekDraftSchema, recipePeekInitial, recipePeekSchema } from "../src/lib/recipe-peek";
import { RecipePeek, RecipePeekContents } from "../src/app/(app)/dishes/recipe-peek";
import { DishForm } from "../src/app/(app)/dishes/dish-form";

const base = { "@type": "Recipe", name: "Quick test soup", recipeIngredient: ["200g carrots", "Salt, to taste"] };
function preview(value: unknown) {
  return extractRecipes(`<script type="application/ld+json">${JSON.stringify(value)}</script>`, "https://example.com/soup", { preview: true });
}

test("peek reads string instructions as plain text steps with paragraph and line breaks", () => {
  const result = preview({ ...base, recipeInstructions: "<p>Chop &amp; rinse.</p><p>Simmer.<br>Serve.</p>" });
  assert.deepEqual(result.recipes[0].instructions, [
    { text: "Chop & rinse." }, { text: "Simmer." }, { text: "Serve." },
  ]);
  assert.deepEqual(result.warnings, []);
});

test("peek preserves HowToStep arrays and named nested HowToSection order", () => {
  const result = preview({
    ...base,
    recipeInstructions: [
      { "@type": "HowToSection", name: "For the <b>soup</b>", itemListElement: [
        { "@type": "HowToStep", text: "Chop the carrots." },
        { "@type": "HowToStep", text: "Simmer." },
      ] },
      { "@type": "HowToSection", name: "To serve", itemListElement: [
        { "@type": "HowToStep", text: "Season &amp; serve." },
      ] },
      "Enjoy.",
    ],
  });
  assert.deepEqual(result.recipes[0].instructions, [
    { text: "Chop the carrots.", section: "For the soup" },
    { text: "Simmer.", section: "For the soup" },
    { text: "Season & serve.", section: "To serve" },
    { text: "Enjoy." },
  ]);
});

test("peek tolerates missing ingredients while standard imports retain strict requirements", () => {
  const methodOnly = { "@type": "Recipe", name: "Soup", recipeInstructions: "Simmer." };
  const result = preview(methodOnly);
  assert.deepEqual(result.recipes[0].ingredients, []);
  assert.deepEqual(result.recipes[0].instructions, [{ text: "Simmer." }]);
  assert.match(result.warnings[0], /Ingredients could not be read/);
  assert.throws(() => extractRecipes(`<script type="application/ld+json">${JSON.stringify(methodOnly)}</script>`), /No usable recipe ingredients/);
  assert.deepEqual(preview(base).recipes[0].instructions, []);
  assert.throws(() => preview({ "@type": "Article" }), /No Schema.org Recipe/);
});

test("method extraction does not mix recipes or silently ignore unsupported details", () => {
  const result = preview([
    { ...base, recipeInstructions: [{ "@type": "HowToStep", url: "https://example.com/step" }, "Simmer."] },
    { ...base, name: "Other soup", recipeInstructions: "Stir." },
  ]);
  assert.deepEqual(result.recipes.map(recipe => recipe.instructions), [[{ text: "Simmer." }], [{ text: "Stir." }]]);
  assert.match(result.warnings[0], /Some method details could not be read/);
});

test("method step and character limits omit, rather than truncate, oversized methods", () => {
  assert.equal(preview({ ...base, recipeInstructions: Array(200).fill("Stir.") }).recipes[0].instructions?.length, 200);
  assert.equal(preview({ ...base, recipeInstructions: "x".repeat(18997) }).recipes[0].instructions?.[0].text.length, 18997);
  for (const recipeInstructions of [Array(201).fill("Stir."), "x".repeat(18998)]) {
    const result = preview({ ...base, recipeInstructions });
    assert.deepEqual(result.recipes[0].instructions, []);
    assert.match(result.warnings[0], /method was omitted/);
  }
});

test("preview renders honest missing sections and escapes extracted markup", () => {
  const html = renderToStaticMarkup(createElement(RecipePeekContents, {
    recipe: { name: "Soup", ingredients: [], instructions: [] },
  }));
  assert.match(html, /Ingredients could not be extracted/);
  assert.match(html, /method could not be extracted/);
  const escaped = renderToStaticMarkup(createElement(RecipePeekContents, {
    recipe: { name: "Soup", ingredients: ["<script>bad</script>"], instructions: [{ text: "<img src=x>", section: "Sauce" }] },
  }));
  assert.match(escaped, /&lt;script&gt;/);
  assert.doesNotMatch(escaped, /<script>|<img/);
  assert.match(escaped, /<ol/);
  assert.match(escaped, /Sauce/);
});

test("Dishes exposes Peek without mounting a reader or creating a draft", () => {
  const html = renderToStaticMarkup(createElement(RecipePeek));
  assert.match(html, />Peek<\/button>/);
  assert.doesNotMatch(html, /<dialog|<form/);
});

test("handoff prepares fields and method Notes without dropping ambiguous ingredient sentences", () => {
  const draft = recipePeekDraftSchema.parse({
    sourceUrl: "https://example.com/soup",
    recipe: {
      name: "Soup",
      ingredients: ["200g carrots", "2 (400g) tins tomatoes", "For the sauce:"],
      instructions: [
        { text: "Chop.", section: "Soup" }, { text: "Simmer.", section: "Soup" },
        { text: "Serve.", section: "Finish" },
      ],
    },
  });
  const result = recipePeekInitial(draft);
  assert.equal(result.initial.ingredients.length, 3);
  assert.equal(result.initial.ingredients[0].quantity, "200");
  assert.equal(result.initial.ingredients[0].unit, "g");
  assert.equal(result.initial.ingredients[1].name, "2 (400g) tins tomatoes");
  assert.equal(result.initial.ingredients[2].name, "For the sauce:");
  assert.equal(result.initial.notes, "Soup\n1. Chop.\n\n2. Simmer.\n\nFinish\n3. Serve.");
  assert.equal(result.initial.sourceUrl, draft.sourceUrl);
  const html = renderToStaticMarkup(createElement(DishForm, {
    initial: result.initial, skipInitialUrlPreview: true, action() {},
  }));
  assert.match(html, /name="name"[^>]*value="Soup"/);
  assert.match(html, /name="ingredient_name"[^>]*value="carrots"/);
  assert.match(html, /Soup\n1\. Chop\./);
  assert.doesNotMatch(html, /Fetching recipe/);
});

test("handoff explicitly flags long ingredient fields and rejects oversized Notes", () => {
  const draft = {
    sourceUrl: "https://example.com/soup",
    recipe: { name: "Soup", ingredients: ["x".repeat(201)], instructions: [] },
  };
  const result = recipePeekInitial(draft);
  assert.equal(result.needsIngredientReview, true);
  assert.equal(result.initial.ingredients[0].name.length, 201);
  assert.throws(() => recipePeekInitial({
    ...draft, recipe: { ...draft.recipe, instructions: [{ text: "x".repeat(20001) }] },
  }), /method is too long/);
});

test("preview and stored draft schemas reject unsafe URLs and malformed contents", () => {
  const recipe = { name: "Soup", ingredients: [], instructions: [] };
  assert.equal(recipePeekSchema.safeParse({ recipes: [recipe], sourceUrl: "https://example.com/soup", warnings: [] }).success, true);
  for (const sourceUrl of ["not-a-url", "", "javascript:alert(1)", "data:text/html,test", "https://user:pass@example.com/"]) {
    assert.equal(recipePeekDraftSchema.safeParse({ sourceUrl, recipe }).success, false);
  }
  assert.equal(recipePeekDraftSchema.safeParse({ sourceUrl: "https://example.com/", recipe: { ...recipe, instructions: [{ text: 10 }] } }).success, false);
});
