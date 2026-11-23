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
  const remove = html.match(/<button[^>]*aria-label="Remove ingredient:[^"]*"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.match(remove, /type="button"/);
  assert.match(remove, /absolute right-2 top-2[^"]*size-10/);
  assert.match(remove, /border-rose-200 text-rose-600/);
  assert.match(remove, /<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(remove, />\s*Remove\s*</);
  assert.doesNotMatch(html, /touch-action|translateX|data-no-swipe/);
});

test("import assignment buttons fill four equal columns with mobile-sized tap targets", () => {
  const html = renderToStaticMarkup(createElement(IngredientSentence, {
    draft: createIngredientDraft("2 tablespoons olive oil"),
    onChange() {},
    onRemove() {},
  }));
  const controls = html.match(/<div class="grid grid-cols-4 gap-2">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(controls);
  const buttons = controls.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.equal(buttons.length, 4);
  for (const [index, label] of ["Quantity", "Unit", "Ingredient", "Notes"].entries()) {
    assert.ok(buttons[index].endsWith(`>${label}</button>`));
    assert.match(buttons[index], /min-h-12 min-w-0 w-full/);
    assert.match(buttons[index], /disabled=""/);
  }
  assert.doesNotMatch(html, /Clear selection/);
  assert.doesNotMatch(html, /Select words, then assign them below|Tap a selected word again to deselect/);
});

test("ingredient import notes are optional, editable and limited to 200 characters", () => {
  const html = renderToStaticMarkup(createElement(IngredientSentence, {
    draft: { ...createIngredientDraft("227 g butter, softened"), notes: "softened" },
    onChange() {},
    onRemove() {},
  }));
  assert.match(html, /Notes \(optional\)<input[^>]*maxLength="200"[^>]*value="softened"/i);
  assert.doesNotMatch(html, /Ingredient notes appear on the dish, not on your shopping list/);
});
