import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecipeClicks, RECIPE_CLICK_DELAY } from "../src/lib/recipe-clicks";

const dish = { id: "dish-1" };

function setup() {
  const calls: string[] = [];
  const clicks = createRecipeClicks({
    single: (value: typeof dish) => calls.push(`single:${value.id}`),
    double: (value: typeof dish) => calls.push(`double:${value.id}`),
    triple: (value: typeof dish) => calls.push(`triple:${value.id}`),
  });
  return { calls, clicks };
}

test("single clicks navigate only after the 400ms gesture window", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  assert.equal(RECIPE_CLICK_DELAY, 400);
  const { calls, clicks } = setup();
  clicks.click(dish);
  context.mock.timers.tick(399);
  assert.deepEqual(calls, []);
  context.mock.timers.tick(1);
  assert.deepEqual(calls, ["single:dish-1"]);
});

test("double clicks wait 400ms after the second click and never navigate", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click(dish);
  context.mock.timers.tick(300);
  clicks.click(dish);
  context.mock.timers.tick(399);
  assert.deepEqual(calls, []);
  context.mock.timers.tick(1);
  assert.deepEqual(calls, ["double:dish-1"]);
  context.mock.timers.tick(1000);
  assert.deepEqual(calls, ["double:dish-1"]);
});

test("triple clicks open quick tagging immediately without navigating or opening the day picker", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click(dish);
  context.mock.timers.tick(300);
  clicks.click(dish);
  context.mock.timers.tick(300);
  clicks.click(dish);
  assert.deepEqual(calls, ["triple:dish-1"]);
  context.mock.timers.tick(1000);
  assert.deepEqual(calls, ["triple:dish-1"]);
});

test("clicks on different recipes cannot combine into double or triple clicks", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click(dish);
  clicks.click(dish);
  clicks.click({ id: "dish-2" });
  context.mock.timers.tick(400);
  assert.deepEqual(calls, ["single:dish-2"]);
});

test("cancellation prevents pending single and double click actions", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  for (const count of [1, 2]) {
    for (let index = 0; index < count; index++) clicks.click(dish);
    clicks.cancel();
    context.mock.timers.tick(1000);
    assert.deepEqual(calls, []);
  }
  clicks.click(dish);
  context.mock.timers.tick(400);
  assert.deepEqual(calls, ["single:dish-1"]);
});

test("clicks outside the window start a separate gesture", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click(dish);
  context.mock.timers.tick(400);
  clicks.click(dish);
  context.mock.timers.tick(400);
  assert.deepEqual(calls, ["single:dish-1", "single:dish-1"]);
});
