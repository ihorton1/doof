import assert from "node:assert/strict";
import { test } from "node:test";
import { extractRecipes, RecipeImportError } from "../src/lib/recipe-import";

function jsonLd(value: unknown) {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

const recipe = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Test recipe",
  recipeIngredient: ["200 g flour", "1 1/2 cups milk", "2 (400g) tins tomatoes", "Salt, to taste"],
};

test("preserves complete sentences, their order and all website-specific formatting", () => {
  assert.deepEqual(extractRecipes(jsonLd(recipe)), {
    recipes: [{ name: "Test recipe", ingredients: recipe.recipeIngredient }],
    warnings: [],
  });
});

test("supports arrays, @graph, nested recipes, type arrays and full Schema.org type URLs", () => {
  const html = jsonLd([
    { "@type": "Organization", name: "Not a recipe" },
    { "@graph": [
      { mainEntity: { ...recipe, "@type": ["Thing", "https://schema.org/Recipe"] } },
      { ...recipe, "@type": "http://schema.org/Recipe", name: "Second" },
    ] },
  ]);
  assert.deepEqual(extractRecipes(html).recipes.map((value) => value.name), ["Test recipe", "Second"]);
});

test("reads different HTML attribute styles and decodes ingredient markup and entities", () => {
  const html = `<SCRIPT data-example=">" TYPE='application/ld+json'>${JSON.stringify({
    ...recipe,
    name: "Rice &amp; beans",
    recipeIngredient: ["  1&nbsp;cup <b>rice</b> ", "&#189; tsp salt", "water &amp; oil"],
  })}</SCRIPT>`;
  assert.deepEqual(extractRecipes(html).recipes[0], {
    name: "Rice & beans",
    ingredients: ["1 cup rice", "\u00bd tsp salt", "water & oil"],
  });
});

test("accepts a single text ingredient without inventing a missing recipe name", () => {
  assert.deepEqual(extractRecipes(jsonLd({ "@type": "Recipe", recipeIngredient: "salt" })).recipes, [
    { name: "", ingredients: ["salt"] },
  ]);
});

test("only actual JSON recipe names are available for importing into the dish title", () => {
  for (const name of [undefined, null, 12, " \t ", "<b></b>"]) {
    assert.equal(extractRecipes(jsonLd({ ...recipe, name })).recipes[0].name, "");
  }
  assert.equal(extractRecipes(jsonLd({ ...recipe, name: " <b>Rice &amp; beans</b> " })).recipes[0].name, "Rice & beans");
  assert.equal(extractRecipes(jsonLd({ ...recipe, name: "a".repeat(201) })).recipes[0].name.length, 200);
});

test("ignores unrelated scripts and deduplicates identical recipes across blocks", () => {
  const html = `<script>${JSON.stringify(recipe)}</script>` + jsonLd(recipe) + jsonLd(recipe);
  assert.equal(extractRecipes(html).recipes.length, 1);
});

test("a malformed block does not hide a later valid recipe and produces a warning", () => {
  const result = extractRecipes('<script type="application/ld+json">{broken}</script>' + jsonLd(recipe));
  assert.equal(result.recipes.length, 1);
  assert.match(result.warnings[0], /invalid JSON/);
});

test("reports missing metadata, missing Recipe, and unusable ingredients explicitly", () => {
  assert.throws(() => extractRecipes("<html>no metadata</html>"), /No Schema.org JSON-LD/);
  assert.throws(() => extractRecipes(jsonLd({ "@type": "Article" })), /No Schema.org Recipe/);
  for (const recipeIngredient of [null, [], [""], [12], [{ name: "flour" }], ["<b></b>"]]) {
    assert.throws(() => extractRecipes(jsonLd({ ...recipe, recipeIngredient })), /No usable recipe ingredients/);
  }
});

test("does not silently truncate long sentences and allows conversion to shorter names", () => {
  const sentence = "flour ".repeat(100).trim();
  assert.equal(extractRecipes(jsonLd({ ...recipe, recipeIngredient: [sentence] })).recipes[0].ingredients[0], sentence);
  assert.throws(() => extractRecipes(jsonLd({ ...recipe, recipeIngredient: ["a".repeat(2001)] })), /2,000 characters/);
});

test("enforces recipe and ingredient count thresholds exactly", () => {
  const atLimit = { ...recipe, recipeIngredient: Array.from({ length: 200 }, () => "salt") };
  assert.equal(extractRecipes(jsonLd(atLimit)).recipes[0].ingredients.length, 200);
  assert.throws(() => extractRecipes(jsonLd({ ...recipe, recipeIngredient: [...atLimit.recipeIngredient, "salt"] })), RecipeImportError);
  const twenty = Array.from({ length: 20 }, (_, index) => ({ ...recipe, name: String(index) }));
  assert.equal(extractRecipes(jsonLd(twenty)).recipes.length, 20);
  assert.throws(() => extractRecipes(jsonLd([...twenty, { ...recipe, name: "21" }])), /too many recipes/);
});

test("skips an unusable recipe with a warning without losing valid recipes", () => {
  const result = extractRecipes(jsonLd([{ ...recipe, recipeIngredient: [] }, recipe]));
  assert.equal(result.recipes.length, 1);
  assert.equal(result.warnings.length, 1);
});

test("large unrelated arrays cannot overflow the traversal argument stack", () => {
  const result = extractRecipes(jsonLd([Array.from({ length: 150_000 }, () => 0), recipe]));
  assert.equal(result.recipes.length, 1);
});

test("extracts image URL strings, arrays and ImageObject metadata", () => {
  const url = "https://images.example.com/dish.jpg";
  for (const image of [
    url,
    [url, "https://images.example.com/alternate.jpg"],
    { "@type": "ImageObject", url },
    { "@type": "ImageObject", contentUrl: url, url: "https://example.com/image-info" },
    [{ "@type": "ImageObject", contentUrl: url }],
    [null, "", { unrelated: true }, "javascript:alert(1)", { url }],
  ]) {
    const result = extractRecipes(jsonLd({ ...recipe, image }));
    assert.equal(result.recipes[0].imageUrl, url);
    assert.deepEqual(result.recipes[0].ingredients, recipe.recipeIngredient);
  }
});

test("resolves relative and protocol-relative images against the final page URL", () => {
  for (const [image, expected] of [
    ["../images/dish.jpg", "https://example.com/images/dish.jpg"],
    ["/images/dish.jpg", "https://example.com/images/dish.jpg"],
    ["//images.example.com/dish.jpg", "https://images.example.com/dish.jpg"],
  ]) {
    const result = extractRecipes(jsonLd({ ...recipe, image }), "https://example.com/recipes/dish");
    assert.equal(result.recipes[0].imageUrl, expected);
  }
});

test("missing or unsafe image metadata leaves ingredients usable without an image", () => {
  assert.equal(extractRecipes(jsonLd(recipe)).recipes[0].imageUrl, undefined);
  for (const image of [
    "", [], 12, { url: false }, "javascript:alert(1)", "data:image/svg+xml,test",
    "file:///image.png", "https://user:pass@example.com/image.jpg",
    "http://localhost/image.jpg", "http://sub.localhost/image.jpg",
    "http://127.0.0.1/image.jpg", "http://192.168.1.1/image.jpg",
    "http://[::1]/image.jpg", "https://example.com:8080/image.jpg",
    `https://example.com/${"a".repeat(4000)}`,
  ]) {
    const result = extractRecipes(jsonLd({ ...recipe, image }));
    assert.equal(result.recipes[0].imageUrl, undefined, JSON.stringify(image));
    assert.equal(result.recipes.length, 1);
    assert.match(result.warnings[0], /image was skipped/);
  }
});

test("images stay associated with their own recipe, not unrelated website metadata", () => {
  const result = extractRecipes(jsonLd([
    { "@type": "Organization", image: "https://example.com/logo.jpg" },
    { ...recipe, name: "First", image: "https://example.com/first.jpg" },
    { ...recipe, name: "Second", image: { url: "https://example.com/second.jpg" } },
    { ...recipe, name: "Third" },
  ]));
  assert.deepEqual(result.recipes.map((value) => value.imageUrl), [
    "https://example.com/first.jpg", "https://example.com/second.jpg", undefined,
  ]);
});
