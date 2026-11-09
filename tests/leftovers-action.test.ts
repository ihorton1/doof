import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../src/lib/auth";
import { getLeftoverWindow } from "../src/lib/leftovers";
import { toISODate } from "../src/lib/utils";
import type { Prisma } from "../src/generated/prisma/client";

async function setup(t: TestContext, authenticated = true) {
  const previousUrl = process.env.DATABASE_URL;
  const previousSecret = process.env.COOKIE_SECRET;
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/leftovers_test";
  process.env.COOKIE_SECRET = "test-only-leftovers-cookie-secret";
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
  const originalUpdate = prisma.mealPlanEntry.updateMany;
  const update = t.mock.fn<(args: Prisma.MealPlanEntryUpdateManyArgs) => Promise<{ count: number }>>(
    async () => ({ count: 1 }),
  );
  // Prisma's proxy descriptors cannot be used with node:test's mock.method.
  Object.defineProperty(prisma.mealPlanEntry, "updateMany", {
    value: update, configurable: true, writable: true,
  });
  t.after(() => Object.defineProperty(prisma.mealPlanEntry, "updateMany", {
    value: originalUpdate, configurable: true, writable: true,
  }));
  const { dismissLeftovers } = await import("../src/app/(app)/today/dismiss-leftovers");
  return { update, revalidate, dismissLeftovers };
}

test("clearing leftovers requires authentication before touching the database", async (t) => {
  const { update, revalidate, dismissLeftovers } = await setup(t, false);
  assert.deepEqual(await dismissLeftovers({ entryId: "meal-1" }), {
    error: "Sign in again before clearing leftovers.",
  });
  assert.equal(update.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("invalid leftover IDs return an explicit error without a write", async (t) => {
  const { update, dismissLeftovers } = await setup(t);
  for (const entryId of ["", "   ", "x".repeat(201)]) {
    assert.deepEqual(await dismissLeftovers({ entryId }), {
      error: "Choose a meal to clear its leftovers.",
    });
  }
  assert.equal(update.mock.callCount(), 0);
});

test("dismissal persists only the occurrence flag and revalidates Today; repeat requests are safe", async (t) => {
  const { update, revalidate, dismissLeftovers } = await setup(t);
  assert.deepEqual(await dismissLeftovers({ entryId: "meal-1" }), { status: "dismissed" });
  assert.deepEqual(update.mock.calls[0].arguments[0], {
    where: {
      id: "meal-1",
      date: getLeftoverWindow(toISODate(new Date())),
      mealSlot: "dinner",
      dishId: { not: null },
      status: { not: "skipped" },
    },
    data: { leftoversDismissed: true },
  });
  assert.deepEqual(revalidate.mock.calls[0].arguments, ["/today"]);
  assert.deepEqual(await dismissLeftovers({ entryId: "meal-1" }), { status: "dismissed" });
  assert.equal(update.mock.callCount(), 2);
});

test("missing, expired or ineligible meals do not report a successful dismissal", async (t) => {
  const { update, revalidate, dismissLeftovers } = await setup(t);
  update.mock.mockImplementation(async () => ({ count: 0 }));
  assert.deepEqual(await dismissLeftovers({ entryId: "expired" }), {
    error: "This meal is no longer available as leftovers. Refresh Today.",
  });
  assert.equal(revalidate.mock.callCount(), 0);
});

test("database failures are logged and surfaced for retry without revalidation", async (t) => {
  const { update, revalidate, dismissLeftovers } = await setup(t);
  const failure = new Error("Test database unavailable");
  update.mock.mockImplementation(async () => { throw failure; });
  const log = t.mock.method(console, "error", () => {});
  assert.deepEqual(await dismissLeftovers({ entryId: "meal-1" }), {
    error: "Could not clear these leftovers. Please try again.",
  });
  assert.deepEqual(log.mock.calls[0].arguments, ["Failed to dismiss leftovers", failure]);
  assert.equal(revalidate.mock.callCount(), 0);
});
