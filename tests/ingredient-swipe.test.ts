import assert from "node:assert/strict";
import { test } from "node:test";
import { ingredientSwipeOffset, isIngredientRemovalSwipe } from "../src/lib/ingredient-swipe";

test("left swipes reveal removal only after horizontal intent, and require 80px to dismiss", () => {
  assert.equal(ingredientSwipeOffset(-11, 0), 0);
  assert.equal(ingredientSwipeOffset(-12, 0), -12);
  assert.equal(ingredientSwipeOffset(-79, 10), -79);
  assert.equal(isIngredientRemovalSwipe(-79, 0), false);
  assert.equal(isIngredientRemovalSwipe(-80, 0), true);
  assert.equal(isIngredientRemovalSwipe(-140, 30), true);
});

test("right, vertical and predominantly diagonal gestures never dismiss", () => {
  for (const [dx, dy] of [[0, 0], [100, 0], [0, 100], [-80, 80], [-120, 80], [-80, -80]]) {
    assert.equal(ingredientSwipeOffset(dx, dy), 0);
    assert.equal(isIngredientRemovalSwipe(dx, dy), false);
  }
});
