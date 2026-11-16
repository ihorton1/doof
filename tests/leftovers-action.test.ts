import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../src/lib/auth";
import { getLeftoverWindow, getManualLeftoverWindow } from "../src/lib/leftovers";
import { addDays, fromISODate, toISODate } from "../src/lib/utils";
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
  const originalCreate = prisma.manualLeftover.create;
  const create = t.mock.fn<(args: Prisma.ManualLeftoverCreateArgs) => Promise<unknown>>(
    async () => ({ id: "manual-1" }),
  );
  Object.defineProperty(prisma.manualLeftover, "create", {
    value: create, configurable: true, writable: true,
  });
  t.after(() => Object.defineProperty(prisma.manualLeftover, "create", {
    value: originalCreate, configurable: true, writable: true,
  }));
  const originalManualUpdate = prisma.manualLeftover.updateMany;
  const manualUpdate = t.mock.fn<(args: Prisma.ManualLeftoverUpdateManyArgs) => Promise<{ count: number }>>(
    async () => ({ count: 1 }),
  );
  Object.defineProperty(prisma.manualLeftover, "updateMany", {
    value: manualUpdate, configurable: true, writable: true,
  });
  t.after(() => Object.defineProperty(prisma.manualLeftover, "updateMany", {
    value: originalManualUpdate, configurable: true, writable: true,
  }));
  const { dismissLeftovers } = await import("../src/app/(app)/today/dismiss-leftovers");
  const { addLeftovers } = await import("../src/app/(app)/today/add-leftovers");
  return { update, create, manualUpdate, revalidate, dismissLeftovers, addLeftovers };
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

test("expired leftovers remain dismissible within the ten-day retention window", async (t) => {
  const { update, dismissLeftovers } = await setup(t);
  const today = fromISODate(toISODate(new Date()));
  update.mock.mockImplementation(async (args) => {
    assert.deepEqual(args.where?.date, { gte: addDays(today, -10), lt: today });
    return { count: 1 };
  });
  assert.deepEqual(await dismissLeftovers({ entryId: "expired-leftover" }), { status: "dismissed" });
  assert.equal(update.mock.callCount(), 1);
});

test("missing, older than ten days or ineligible meals do not report a successful dismissal", async (t) => {
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

test("adding manual leftovers requires authentication before writing", async (t) => {
    const { create, revalidate, addLeftovers } = await setup(t, false);
    assert.deepEqual(await addLeftovers({ name: "Soup", cookedDate: toISODate(new Date()) }), {
      error: "Sign in again before adding leftovers.",
    });
    assert.equal(create.mock.callCount(), 0);
    assert.equal(revalidate.mock.callCount(), 0);
  });

test("manual leftovers validate names and calendar dates without writing", async (t) => {
    const { create, revalidate, addLeftovers } = await setup(t);
    const cookedDate = toISODate(new Date());
    for (const input of [
      { name: "   ", cookedDate },
      { name: "x".repeat(201), cookedDate },
      { name: "Soup", cookedDate: "" },
      { name: "Soup", cookedDate: "2026-02-30" },
      { name: "Soup", cookedDate: "2026-13-01" },
      { name: "Soup", cookedDate: "2026-2-1" },
    ]) {
      assert.deepEqual(await addLeftovers(input), {
        error: "Enter a name (up to 200 characters) and a valid cooked date.",
      });
    }
    for (const offset of [-11, 1]) {
      assert.deepEqual(await addLeftovers({
        name: "Soup", cookedDate: toISODate(addDays(fromISODate(cookedDate), offset)),
      }), { error: "Choose a cooked date from today or the previous ten days." });
    }
    assert.equal(create.mock.callCount(), 0);
    assert.equal(revalidate.mock.callCount(), 0);
  });

test("today and the oldest retained cooked date persist independently of the meal plan", async (t) => {
    const { create, update, manualUpdate, revalidate, addLeftovers } = await setup(t);
    const today = fromISODate(toISODate(new Date()));
    for (const offset of [0, -10]) {
      const cookedDate = addDays(today, offset);
      assert.deepEqual(await addLeftovers({ name: "  Soup  ", cookedDate: toISODate(cookedDate) }), {
        status: "added",
      });
      assert.deepEqual(create.mock.calls.at(-1)?.arguments[0], {
        data: { name: "Soup", cookedDate },
      });
    }
    assert.equal(update.mock.callCount(), 0);
    assert.equal(manualUpdate.mock.callCount(), 0);
    assert.deepEqual(revalidate.mock.calls.map(({ arguments: args }) => args), [["/today"], ["/today"]]);
  });

test("manual leftover creation failures are logged and retryable", async (t) => {
    const { create, revalidate, addLeftovers } = await setup(t);
    const failure = new Error("Test write failed");
    create.mock.mockImplementation(async () => { throw failure; });
    const log = t.mock.method(console, "error", () => {});
    assert.deepEqual(await addLeftovers({ name: "Soup", cookedDate: toISODate(new Date()) }), {
      error: "Could not add these leftovers. Please try again.",
    });
    assert.deepEqual(log.mock.calls[0].arguments, ["Failed to add leftovers", failure]);
    assert.equal(revalidate.mock.callCount(), 0);
  });

test("manual leftovers are dismissible today and route only to their own table", async (t) => {
    const { update, manualUpdate, revalidate, dismissLeftovers } = await setup(t);
    const input = { entryId: "manual-1", source: "manual" } as const;
    assert.deepEqual(await dismissLeftovers(input), { status: "dismissed" });
    assert.deepEqual(manualUpdate.mock.calls[0].arguments[0], {
      where: { id: "manual-1", cookedDate: getManualLeftoverWindow(toISODate(new Date())) },
      data: { dismissed: true },
    });
    assert.equal(update.mock.callCount(), 0);
    assert.deepEqual(revalidate.mock.calls[0].arguments, ["/today"]);
    assert.deepEqual(await dismissLeftovers(input), { status: "dismissed" });
  });

test("manual dismissal requires authentication", async (t) => {
    const { manualUpdate, revalidate, dismissLeftovers } = await setup(t, false);
    assert.deepEqual(await dismissLeftovers({ entryId: "manual-1", source: "manual" }), {
      error: "Sign in again before clearing leftovers.",
    });
    assert.equal(manualUpdate.mock.callCount(), 0);
    assert.equal(revalidate.mock.callCount(), 0);
  });

test("manual dismissal failures and missing rows do not report success", async (t) => {
    const { manualUpdate, revalidate, dismissLeftovers } = await setup(t);
    const input = { entryId: "manual-1", source: "manual" } as const;
    manualUpdate.mock.mockImplementation(async () => ({ count: 0 }));
    assert.deepEqual(await dismissLeftovers(input), {
      error: "This meal is no longer available as leftovers. Refresh Today.",
    });
    const failure = new Error("Test dismissal failed");
    manualUpdate.mock.mockImplementation(async () => { throw failure; });
    const log = t.mock.method(console, "error", () => {});
    assert.deepEqual(await dismissLeftovers(input), {
      error: "Could not clear these leftovers. Please try again.",
    });
  assert.deepEqual(log.mock.calls[0].arguments, ["Failed to dismiss leftovers", failure]);
  assert.equal(revalidate.mock.callCount(), 0);
});
