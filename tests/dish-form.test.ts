import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DishForm } from "../src/app/(app)/dishes/dish-form";

test("dish notes are a multiline field below ingredients with shopping-list guidance", () => {
  const html = renderToStaticMarkup(createElement(DishForm, { action() {} }));
  const textarea = html.match(/<textarea\b[^>]*name="notes"[^>]*>/)?.[0];
  assert.ok(textarea);
  assert.match(textarea, /rows="6"/);
  assert.match(textarea, /maxLength="20000"/i);
  assert.match(textarea, /aria-describedby="dish-notes-help"/);
  assert.match(textarea, /!h-auto min-h-40 resize-y/);
  assert.match(html, /id="dish-notes-help"/);
  assert.match(html, /Saved with the dish, never added to your shopping list/);
  assert.ok(html.indexOf('name="ingredient_name"') < html.indexOf('name="notes"'));
});

test("editing preserves existing multiline notes in the submitted field", () => {
  const notes = "Make ahead.\nUse a potato ricer.";
  const html = renderToStaticMarkup(createElement(DishForm, {
    action() {},
    initial: { notes },
  }));
  assert.ok(html.includes(`>${notes}</textarea>`));
});

test("each ingredient has a separate optional note field with existing values preserved", () => {
  const html = renderToStaticMarkup(createElement(DishForm, {
    action() {},
    initial: {
      ingredients: [
        { name: "butter", quantity: "227", unit: "g", notes: "room temperature" },
        { name: "garlic", quantity: "1", unit: "head", notes: null },
      ],
    },
  }));
  const fields = html.match(/<input\b[^>]*name="ingredient_notes"[^>]*>/g) ?? [];
  assert.equal(fields.length, 2);
  assert.doesNotMatch(html, /ingredient-notes-help/);
  assert.match(fields[0], /value="room temperature"/);
  assert.match(fields[1], /value=""/);
  for (const [index, field] of fields.entries()) {
    assert.match(field, /maxLength="200"/i);
    assert.ok(field.includes(`aria-label="Notes for ingredient ${index + 1}"`));
    assert.match(field, /col-start-2 row-start-2 sm:col-start-4 sm:row-start-1/);
  }
  assert.doesNotMatch(html, /Ingredient notes \(e\.g\./);
});
