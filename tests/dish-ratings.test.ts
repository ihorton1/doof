import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DishRatingBadge } from "../src/components/dish-rating-badge";
import { DishRatingControl, DishRatingOptions } from "../src/components/dish-rating-control";
import { DishForm } from "../src/app/(app)/dishes/dish-form";
import { DISH_RATINGS, dishRatingSchema } from "../src/lib/dish-ratings";
import { DishRating } from "../src/generated/prisma/enums";

test("ratings are the four approved labels or explicit null, with no default", () => {
  assert.deepEqual(DISH_RATINGS, ["dud", "eh", "yum", "delish"]);
  assert.deepEqual(Object.values(DishRating), DISH_RATINGS);
  for (const value of [...DISH_RATINGS, null]) {
    assert.equal(dishRatingSchema.parse(value), value);
  }
  for (const value of [undefined, "", "great", "Yum", 1]) {
    assert.equal(dishRatingSchema.safeParse(value).success, false);
  }
});

test("read-only badges use distinct colors and text, and omit unrated dishes", () => {
  const colors = ["rose", "amber", "emerald", "purple"];
  for (const [index, rating] of DISH_RATINGS.entries()) {
    const html = renderToStaticMarkup(createElement(DishRatingBadge, { rating }));
    assert.match(html, new RegExp(`aria-label="Rating: ${rating}"`));
    assert.match(html, new RegExp(`>${rating}</span>`));
    assert.ok(html.includes(`bg-${colors[index]}-100`));
    assert.ok(html.includes(`dark:text-${colors[index]}-200`));
    assert.doesNotMatch(html, /<button|<a/);
  }
  assert.equal(renderToStaticMarkup(createElement(DishRatingBadge, { rating: null })), "");
});

test("rating choices have explicit button types, selected state and a clear option", () => {
  for (const rating of [...DISH_RATINGS, null]) {
    const html = renderToStaticMarkup(createElement(DishRatingOptions, { rating, onChange() {} }));
    assert.equal((html.match(/<button type="button"/g) ?? []).length, 5);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, rating ? 1 : 0);
    assert.match(html, /aria-label="Dish rating"/);
    assert.match(html, /Clear rating/);
    assert.equal((html.match(/disabled=""/g) ?? []).length, rating ? 0 : 1);
  }
});

test("saving disables every choice and the clear button", () => {
  const html = renderToStaticMarkup(createElement(DishRatingOptions, {
    rating: "yum", disabled: true, onChange() {},
  }));
  assert.equal((html.match(/disabled=""/g) ?? []).length, 5);
});

test("explicit rating triggers are separate from recipe gestures, with no initial dialog", () => {
  for (const rating of [...DISH_RATINGS, null]) {
    const html = renderToStaticMarkup(createElement(DishRatingControl, {
      dish: { id: "dish-1", name: "Soup", rating },
      setRatingAction: async ({ rating }) => ({ rating }),
    }));
    assert.match(html, /data-rating-control="true"/);
    assert.match(html, /aria-haspopup="dialog" aria-expanded="false"/);
    assert.ok(html.includes(rating ? `Change rating for Soup: ${rating}` : "Rate Soup"));
    if (!rating) assert.match(html, />Rate dish<\/span>/);
    assert.doesNotMatch(html, /<dialog|aria-keyshortcuts/);
  }
});

test("dish forms submit an optional rating independently from recipe imports and tags", () => {
  for (const rating of [...DISH_RATINGS, null]) {
    const html = renderToStaticMarkup(createElement(DishForm, {
      action() {}, initial: { name: "Soup", rating },
    }));
    assert.match(html, /Rating \(optional\)/);
    assert.ok(html.includes(`type="hidden" name="rating" value="${rating ?? ""}"`));
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, rating ? 1 : 0);
  }
  const html = renderToStaticMarkup(createElement(DishForm, { action() {} }));
  assert.match(html, /name="rating" value=""/);
});
