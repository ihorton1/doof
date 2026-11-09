import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Prisma } from "../src/generated/prisma/client";

test("Plan loads every plan occurrence and renders Most cooked after the carousel", async (t) => {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/plan_test";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });
  const { prisma } = await import("../src/lib/prisma");
  const recipes = ["Soup", "Pasta"].map(name => ({
    id: name.toLowerCase(), name, description: null,
    updatedAt: new Date("2026-11-09T00:00:00Z"),
    tags: [{ tag: { name: "quick" } }], ingredients: [],
  }));
  const history = [
    { dishId: "soup", date: new Date("2020-01-01"), status: "planned" },
    { dishId: "soup", date: new Date("2030-01-01"), status: "skipped" },
    { dishId: "soup", date: new Date("2030-01-01"), status: "cooked" },
    { dishId: "pasta", date: new Date("2026-11-09"), status: "planned" },
  ];
  const meals = t.mock.fn<(args: Prisma.MealPlanEntryFindManyArgs) => Promise<typeof history>>(
    async () => history,
  );
  const overrides = [
    { target: prisma.dish, key: "findMany", value: t.mock.fn(async () => recipes) },
    { target: prisma.mealPlanEntry, key: "findMany", value: meals },
    { target: prisma.tag, key: "findMany", value: t.mock.fn(async () => [{ name: "quick" }]) },
    { target: prisma, key: "$queryRaw", value: t.mock.fn(async () => [{ id: "soup" }]) },
  ];
  for (const { target, key, value } of overrides) {
    const original = Reflect.get(target, key);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
    t.after(() => Object.defineProperty(target, key, {
      value: original, configurable: true, writable: true,
    }));
  }
  const { SavedDishes } = await import("../src/app/(app)/plan/saved-dishes");
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} },
  }, await SavedDishes()));
  assert.deepEqual(meals.mock.calls[0].arguments[0], {
    where: { dishId: { not: null } },
    select: { dishId: true, date: true, status: true },
  });
  const listStart = html.indexOf('<section aria-labelledby="most-cooked-heading"');
  assert.ok(listStart > html.lastIndexOf('aria-roledescription="slide"'));
  const list = html.slice(listStart);
  assert.match(list, /aria-label="Added to plan 3 times"/);
  assert.match(list, /aria-label="Added to plan 1 time"/);
  assert.match(list, /src="\/api\/dishes\/soup\/image\?v=/);
  assert.ok(list.indexOf('href="/dishes/soup"') < list.indexOf('href="/dishes/pasta"'));
});
