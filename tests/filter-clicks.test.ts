import assert from "node:assert/strict";
import { test } from "node:test";
import { createFilterClicks } from "../src/lib/filter-clicks";
import { RECIPE_CLICK_DELAY } from "../src/lib/recipe-clicks";

function setup() {
  const calls: string[] = [];
  const clicks = createFilterClicks({ single: () => calls.push("single"), double: () => calls.push("exclude") });
  return { calls, clicks };
}

test("single filter clicks wait for the double-click window before clearing or toggling", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click();
  context.mock.timers.tick(RECIPE_CLICK_DELAY - 1);
  assert.deepEqual(calls, []);
  context.mock.timers.tick(1);
  assert.deepEqual(calls, ["single"]);
});

test("double clicks exclude immediately without running single-click removal", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click();
  context.mock.timers.tick(200);
  clicks.click();
  assert.deepEqual(calls, ["exclude"]);
  context.mock.timers.tick(1000);
  assert.deepEqual(calls, ["exclude"]);
});

test("each bubble keeps independent pending clicks so rapid selections all apply", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const first = setup();
  const second = setup();
  first.clicks.click();
  context.mock.timers.tick(100);
  second.clicks.click();
  context.mock.timers.tick(RECIPE_CLICK_DELAY);
  assert.deepEqual(first.calls, ["single"]);
  assert.deepEqual(second.calls, ["single"]);
});

test("cancellation prevents delayed changes after reset, pointer cancellation or unmount", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, clicks } = setup();
  clicks.click();
  clicks.cancel();
  context.mock.timers.tick(1000);
  assert.deepEqual(calls, []);
  clicks.click();
  context.mock.timers.tick(RECIPE_CLICK_DELAY);
  assert.deepEqual(calls, ["single"]);
});
