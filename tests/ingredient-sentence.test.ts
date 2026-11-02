import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createIngredientDraft } from "../src/lib/ingredient-conversion";
import { IngredientSentence } from "../src/app/(app)/dishes/ingredient-sentence";

test("import rows show suggested fields, editable word controls and accessible removal without numbered headings", () => {
  const html = renderToStaticMarkup(createElement(IngredientSentence, {
    draft: createIngredientDraft("2 tablespoons olive oil"),
    onChange() {},
    onRemove() {},
  }));
  assert.match(html, /aria-label="Ingredient: 2 tablespoons olive oil"/);
  assert.match(html, /aria-label="Remove ingredient: 2 tablespoons olive oil"/);
  assert.match(html, /aria-label="Original sentence: select words"/);
  for (const value of ["2", "tablespoons", "olive oil"]) {
    assert.ok(html.includes(`value="${value}"`), value);
  }
  assert.doesNotMatch(html, /Sentence \d|<legend/);
  assert.match(html, /touch-action:pan-y pinch-zoom/);
});
