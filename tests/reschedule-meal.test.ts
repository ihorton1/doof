import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import nextHeaders from "next/headers";
import nextCache from "next/cache";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "../src/lib/auth";
import { getLeftovers } from "../src/lib/leftovers";
import { fromISODate, getWeekStart } from "../src/lib/utils";
import { Prisma } from "../src/generated/prisma/client";

async function setup(t: TestContext, authenticated = true) {
  const previousUrl = process.env.DATABASE_URL;
  const previousSecret = process.env.COOKIE_SECRET;
  process.env.DATABASE_URL = "postgresql://localhost:1/reschedule_test";
  process.env.COOKIE_SECRET = "test-only-reschedule-cookie-secret";
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
  const entry = {
    id: "meal-1", mealPlanId: "old-week", date: fromISODate("2026-11-19"),
    mealSlot: "dinner", dishId: "dish-1" as string | null, freeformText: null as string | null,
    status: "cooked", cookedAt: new Date("2026-11-19T18:00:00Z"), leftoversDismissed: false,
  };
  const findUnique = t.mock.fn<() => Promise<typeof entry | null>>(async () => entry);
  const findFirst = t.mock.fn<() => Promise<{ id: string } | null>>(async () => null);
  const count = t.mock.fn(async () => 0);
  const upsert = t.mock.fn<(args: Prisma.MealPlanUpsertArgs) => Promise<{ id: string }>>(async () => ({ id: "new-week" }));
  const update = t.mock.fn(async (args: Prisma.MealPlanEntryUpdateArgs) => {
    if (args.data.date instanceof Date) entry.date = args.data.date;
    if (typeof args.data.mealPlanId === "string") entry.mealPlanId = args.data.mealPlanId;
    return entry;
  });
  const tx = { mealPlanEntry: { findUnique, findFirst, count, update }, mealPlan: { upsert } };
  const transaction = t.mock.fn<(callback: (client: typeof tx) => Promise<unknown>, options: unknown) => Promise<unknown>>(async (callback) => callback(tx));
  const { prisma } = await import("../src/lib/prisma");
  const original = prisma.$transaction;
  Object.defineProperty(prisma, "$transaction", { value: transaction, configurable: true, writable: true });
  t.after(() => Object.defineProperty(prisma, "$transaction", { value: original, configurable: true, writable: true }));
  const { rescheduleMeal } = await import("../src/app/(app)/today/reschedule-meal");
  return { entry, tx, findUnique, findFirst, count, upsert, update, transaction, revalidate, rescheduleMeal };
}

test("rescheduling requires authentication and valid IDs and calendar dates", async (t) => {
  const unauth = await setup(t, false);
  assert.deepEqual(await unauth.rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), {
    error: "Sign in again before rescheduling a meal.",
  });
  assert.equal(unauth.transaction.mock.callCount(), 0);
});

test("invalid rescheduling input never touches the database", async (t) => {
  const { rescheduleMeal, transaction } = await setup(t);
  for (const input of [
    { entryId: "", date: "2026-11-20" },
    { entryId: "   ", date: "2026-11-20" },
    { entryId: "x".repeat(201), date: "2026-11-20" },
    { entryId: "meal-1", date: "2026-02-30" },
    { entryId: "meal-1", date: "2026-13-01" },
  ]) {
    assert.deepEqual(await rescheduleMeal(input), { error: "Choose a meal and a valid date." });
  }
  assert.equal(transaction.mock.callCount(), 0);
});

test("rescheduling moves only the occurrence date and week, preserving status and dismissal", async (t) => {
  const { rescheduleMeal, entry, update, upsert, transaction, revalidate } = await setup(t);
  entry.leftoversDismissed = true;
  const before = { ...entry };
  const date = fromISODate("2026-11-24");
  assert.deepEqual(await rescheduleMeal({ entryId: entry.id, date: "2026-11-24" }), { status: "rescheduled" });
  assert.deepEqual(update.mock.calls[0].arguments[0], {
    where: { id: entry.id }, data: { date, mealPlanId: "new-week" },
  });
  assert.deepEqual(entry, { ...before, date, mealPlanId: "new-week" });
  assert.deepEqual(upsert.mock.calls[0].arguments[0], {
    where: { weekStartDate: getWeekStart(date) },
    create: { weekStartDate: getWeekStart(date) }, update: {}, select: { id: true },
  });
  assert.deepEqual(transaction.mock.calls[0].arguments[1], { isolationLevel: "Serializable" });
  assert.deepEqual(revalidate.mock.calls.map(call => call.arguments), [
    ["/today"], ["/meals"], ["/plan"], ["/shop"], ["/dishes", "layout"],
  ]);
});

test("moving a meal recalculates countdown, expiry and eligibility using the real date", async (t) => {
  const { rescheduleMeal, entry } = await setup(t);
  const leftovers = () => getLeftovers([{
    ...entry, dishImageUrl: null, dish: { id: "dish-1", name: "Soup" },
  }], "2026-11-22");
  assert.equal(leftovers()[0].daysRemaining, 2);
  await rescheduleMeal({ entryId: entry.id, date: "2026-11-21" });
  assert.equal(leftovers()[0].plannedDate, "2026-11-21");
  assert.equal(leftovers()[0].daysRemaining, 4);
  await rescheduleMeal({ entryId: entry.id, date: "2026-11-17" });
  assert.equal(leftovers()[0].daysRemaining, 0);
  for (const date of ["2026-11-22", "2026-11-23", "2026-11-11"]) {
    await rescheduleMeal({ entryId: entry.id, date });
    assert.deepEqual(leftovers(), []);
  }
});

test("freeform meals move without saved-dish duplicate checks", async (t) => {
  const { rescheduleMeal, entry, findFirst, count, update } = await setup(t);
  entry.dishId = null;
  entry.freeformText = "Takeaway";
  assert.deepEqual(await rescheduleMeal({ entryId: entry.id, date: "2026-11-20" }), { status: "rescheduled" });
  assert.equal(findFirst.mock.callCount(), 0);
  assert.equal(count.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 1);
});

test("same-date saves are safe without changing the occurrence", async (t) => {
  const { rescheduleMeal, update, upsert } = await setup(t);
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-19" }), { status: "rescheduled" });
  assert.equal(update.mock.callCount(), 0);
  assert.equal(upsert.mock.callCount(), 0);
});

test("missing and non-dinner meals return an error rather than success", async (t) => {
  const { rescheduleMeal, entry, findUnique, update, revalidate } = await setup(t);
  entry.mealSlot = "lunch";
  assert.deepEqual(await rescheduleMeal({ entryId: entry.id, date: "2026-11-20" }), {
    error: "This meal is no longer available. Refresh Today.",
  });
  findUnique.mock.mockImplementation(async () => null);
  assert.deepEqual(await rescheduleMeal({ entryId: entry.id, date: "2026-11-20" }), {
    error: "This meal is no longer available. Refresh Today.",
  });
  assert.equal(update.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("destination duplicates and full days leave the original meal untouched", async (t) => {
  const { rescheduleMeal, findFirst, count, update, revalidate } = await setup(t);
  findFirst.mock.mockImplementation(async () => ({ id: "other-meal" }));
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), {
    error: "This dish is already planned for that day. Choose another date.",
  });
  findFirst.mock.mockImplementation(async () => null);
  count.mock.mockImplementation(async () => 50);
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), {
    error: "This day already has 50 dishes. Remove one in Meals first.",
  });
  assert.equal(update.mock.callCount(), 0);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("the fiftieth saved dish is allowed without replacing existing meals", async (t) => {
  const { rescheduleMeal, count, update } = await setup(t);
  count.mock.mockImplementation(async () => 49);
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), { status: "rescheduled" });
  assert.equal(update.mock.callCount(), 1);
});

test("serialization conflicts retry the complete transaction", async (t) => {
  const { rescheduleMeal, transaction, tx } = await setup(t);
  let attempts = 0;
  transaction.mock.mockImplementation(async (callback) => {
    if (attempts++ === 0) throw new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "test" });
    return callback(tx);
  });
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), { status: "rescheduled" });
  assert.equal(transaction.mock.callCount(), 2);
});

test("database failures are logged and shown without refreshing success", async (t) => {
  const { rescheduleMeal, transaction, revalidate } = await setup(t);
  const failure = new Error("Database unavailable");
  transaction.mock.mockImplementation(async () => { throw failure; });
  const log = t.mock.method(console, "error", () => {});
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), {
    error: "Could not reschedule this meal. Please try again.",
  });
  assert.deepEqual(log.mock.calls[0].arguments, ["Failed to reschedule meal", failure]);
  assert.equal(revalidate.mock.callCount(), 0);
});

test("persistent serialization conflicts stop after three attempts with an explicit error", async (t) => {
  const { rescheduleMeal, transaction, revalidate } = await setup(t);
  transaction.mock.mockImplementation(async () => {
    throw new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "test" });
  });
  const log = t.mock.method(console, "error", () => {});
  assert.deepEqual(await rescheduleMeal({ entryId: "meal-1", date: "2026-11-20" }), {
    error: "Could not reschedule this meal. Please try again.",
  });
  assert.equal(transaction.mock.callCount(), 3);
  assert.equal(log.mock.callCount(), 1);
  assert.equal(revalidate.mock.callCount(), 0);
});
