import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../src/lib/auth";
import { DISH_RATINGS } from "../src/lib/dish-ratings";
import type { Prisma } from "../src/generated/prisma/client";

async function setup(t: TestContext, authenticated = true) {
  const previousUrl = process.env.DATABASE_URL;
  const previousSecret = process.env.COOKIE_SECRET;
  process.env.DATABASE_URL = "postgresql://localhost:1/ratings_test";
  process.env.COOKIE_SECRET = "test-only-rating-cookie-secret";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.COOKIE_SECRET;
    else process.env.COOKIE_SECRET = previousSecret;
  });
  const headers = new Headers();
  if (authenticated) headers.set("cookie", `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}`);
  t.mock.method(nextHeaders, "cookies", async () =>
    RequestCookiesAdapter.seal(new RequestCookies(headers)),
  );
  const revalidate = t.mock.method(nextCache, "revalidatePath", () => {});
  const { prisma } = await import("../src/lib/prisma");
  const saveRating = t.mock.fn<(args: Prisma.DishUpdateManyArgs) => Promise<{ count: number }>>(
    async () => ({ count: 1 }),
  );
  const create = t.mock.fn<(args: Prisma.DishCreateArgs) => Promise<{ id: string }>>(
    async () => ({ id: "dish-new" }),
  );
  const update = t.mock.fn<(args: Prisma.DishUpdateArgs) => Promise<{ id: string }>>(
    async () => ({ id: "dish-1" }),
  );
  const overrides = [
    { target: prisma.dish, key: "updateMany", value: saveRating },
    { target: prisma.dish, key: "create", value: create },
    { target: prisma.dish, key: "update", value: update },
    { target: prisma.dishIngredient, key: "deleteMany", value: t.mock.fn(async () => ({ count: 0 })) },
    { target: prisma.dishTag, key: "deleteMany", value: t.mock.fn(async () => ({ count: 0 })) },
    { target: prisma, key: "$transaction", value: t.mock.fn(async (queries: unknown[]) => Promise.all(queries)) },
  ];
  for (const { target, key, value } of overrides) {
    const original = Reflect.get(target, key);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
    t.after(() => Object.defineProperty(target, key, { value: original, configurable: true, writable: true }));
  }
  const { setDishRating } = await import("../src/app/(app)/dishes/set-dish-rating");
  const { createDish, updateDish } = await import("../src/app/(app)/dishes/actions");
  return { saveRating, create, update, revalidate, setDishRating, createDish, updateDish };
}

function form(rating?: string) {
  const data = new FormData();
  data.set("name", "Test dinner");
  if (rating !== undefined) data.set("rating", rating);
  return data;
}

test("quick ratings require authentication before any write or revalidation", async (t) => {
  const { setDishRating, saveRating, revalidate } = await setup(t, false);
  assert.deepEqual(await setDishRating({ dishId: "dish-1", rating: "yum" }), {
    error: "Sign in again before rating a dish.",
  });
  assert.equal(saveRating.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("dish form rating writes also require authentication", async (t) => {
  const { createDish, updateDish, create, update, revalidate } = await setup(t, false);
  await assert.rejects(() => createDish(form("yum")), /Sign in again/);
  await assert.rejects(() => updateDish("dish-1", form("yum")), /Sign in again/);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("quick rating rejects invalid payloads rather than silently clearing a rating", async (t) => {
  const { setDishRating, saveRating, revalidate } = await setup(t);
  const inputs = [
    null, {}, { dishId: "dish-1" },
    ...["", "great", "YUM", 4, undefined].map(rating => ({ dishId: "dish-1", rating })),
    ...["", " ", "x".repeat(201)].map(dishId => ({ dishId, rating: "yum" })),
  ];
  for (const input of inputs) {
    assert.deepEqual(await Reflect.apply(setDishRating, undefined, [input]), {
      error: "Choose a dish and a valid rating, or clear the rating.",
    });
  }
  assert.equal(saveRating.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("each quick rating and clear persist only the dish rating and refresh every rating surface", async (t) => {
  const { setDishRating, saveRating, revalidate } = await setup(t);
  for (const rating of [...DISH_RATINGS, null]) {
    assert.deepEqual(await setDishRating({ dishId: " dish-1 ", rating }), { rating });
    assert.deepEqual(saveRating.mock.calls.at(-1)?.arguments[0], {
      where: { id: "dish-1" }, data: { rating },
    });
  }
  assert.deepEqual(revalidate.mock.calls.slice(0, 5).map(call => call.arguments[0]), [
    "/dishes", "/dishes/dish-1", "/dishes/dish-1/edit", "/today", "/plan",
  ]);
  assert.equal(revalidate.mock.callCount(), 25);
});

test("rating a removed dish reports an error, not success", async (t) => {
  const { setDishRating, saveRating, revalidate } = await setup(t);
  saveRating.mock.mockImplementation(async () => ({ count: 0 }));
  assert.deepEqual(await setDishRating({ dishId: "gone", rating: null }), {
    error: "This dish no longer exists. Refresh your saved dishes.",
  });
  assert.equal(revalidate.mock.callCount(), 0);
});

test("rating failures are logged and surfaced for retry without revalidation", async (t) => {
  const { setDishRating, saveRating, revalidate } = await setup(t);
  const failure = new Error("Test database unavailable");
  saveRating.mock.mockImplementation(async () => { throw failure; });
  const log = t.mock.method(console, "error", () => {});
  assert.deepEqual(await setDishRating({ dishId: "dish-1", rating: "dud" }), {
    error: "Could not save this rating. Please try again.",
  });
  assert.deepEqual(log.mock.calls[0].arguments, ["Failed to save dish rating", failure]);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("new dishes can stay unrated or save any of the four ratings", async (t) => {
  const { createDish, create } = await setup(t);
  for (const rating of [undefined, "", ...DISH_RATINGS]) {
    await assert.rejects(() => createDish(form(rating)), /NEXT_REDIRECT/);
    assert.equal(create.mock.calls.at(-1)?.arguments[0].data.rating, rating || null);
  }
});

test("regular edits save and clear ratings, but missing fields preserve older clients' ratings", async (t) => {
  const { updateDish, update, revalidate } = await setup(t);
  for (const rating of [...DISH_RATINGS, "", undefined]) {
    await assert.rejects(() => updateDish("dish-1", form(rating)), /NEXT_REDIRECT/);
    assert.equal(update.mock.calls.at(-1)?.arguments[0].data.rating, rating === "" ? null : rating);
  }
  const paths = revalidate.mock.calls.map(call => call.arguments[0]);
  for (const path of ["/today", "/plan", "/dishes", "/dishes/dish-1", "/dishes/dish-1/edit"]) {
    assert.ok(paths.includes(path), path);
  }
});

test("invalid form ratings fail validation without creating or changing a dish", async (t) => {
  const { createDish, updateDish, create, update } = await setup(t);
  await assert.rejects(() => createDish(form("great")), /Invalid option/);
  await assert.rejects(() => updateDish("dish-1", form("great")), /Invalid option/);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});
