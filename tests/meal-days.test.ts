import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildMealDays, fetchMealDays, mealDaysPageSchema } from "../src/lib/meal-days";
import { getWeekStart, fromISODate, toISODate } from "../src/lib/utils";
import { PlanDays } from "../src/app/(app)/plan/plan-days";
import { PlanMonth, buildMonthCells } from "../src/app/(app)/plan/plan-month";

test("rolling days start at the supplied day and cross the Sunday/Monday boundary", () => {
  const page = buildMealDays("2026-10-30");
  assert.deepEqual(page.days.map((day) => day.iso), [
    "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02",
    "2026-11-03", "2026-11-04", "2026-11-05",
  ]);
  assert.equal(page.nextDate, "2026-11-06");
  assert.equal(toISODate(getWeekStart(fromISODate(page.days[2].iso))), "2026-10-26");
  assert.equal(toISODate(getWeekStart(fromISODate(page.days[3].iso))), "2026-11-02");
});

test("consecutive chunks contain exactly seven days without duplicates or gaps across a year", () => {
  const first = buildMealDays("2026-12-28");
  const second = buildMealDays(first.nextDate);
  const third = buildMealDays(second.nextDate);
  const dates = [first, second, third].flatMap((page) => page.days.map((day) => day.iso));
  assert.equal(dates.length, 21);
  assert.equal(new Set(dates).size, 21);
  assert.equal(dates[6], "2027-01-03");
  assert.equal(dates[7], "2027-01-04");
  assert.equal(dates.at(-1), "2027-01-17");
  assert.equal(third.nextDate, "2027-01-18");
});

test("rolling chunks include leap day and reject invalid calendar dates", () => {
  const page = buildMealDays("2028-02-26");
  assert.equal(page.days[3].iso, "2028-02-29");
  assert.equal(page.days[4].iso, "2028-03-01");
  for (const invalid of ["2026-02-29", "2026-13-01", "invalid"]) {
    assert.throws(() => buildMealDays(invalid));
  }
});

test("calendar arithmetic remains consecutive through both daylight-saving transitions", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    for (const [start, end] of [["2026-03-27", "2026-04-03"], ["2026-10-23", "2026-10-30"]]) {
      const page = buildMealDays(start);
      assert.equal(page.days.length, 7);
      assert.equal(new Set(page.days.map((day) => day.iso)).size, 7);
      assert.equal(page.nextDate, end);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("Day view renders seven dates, retained dish metadata, Day/Month toggle and manual loading", () => {
  const initialPage = {
    ...buildMealDays("2026-10-30"),
    grid: {
      "2026-11-02|dinner": [{
        id: "entry-1", dishId: "dish-1", dishName: "Soup",
        dishImageUrl: "/image", dishTags: ["quick"], freeformText: null, status: "skipped",
      }],
    },
  };
  const html = renderToStaticMarkup(createElement(PlanDays, {
    initialPage, dishes: [], monthParam: "2026-10", saveMealsAction: async () => [],
  }));
  assert.equal((html.match(/data-meal-date="/g) ?? []).length, 7);
  assert.match(html, /data-meal-date="2026-10-30"/);
  assert.match(html, /data-meal-date="2026-11-05"/);
  assert.match(html, /href="\/dishes\/dish-1"/);
  assert.match(html, /line-through/);
  assert.match(html, />quick<\/span>/);
  assert.match(html, /aria-current="page"[^>]*>Day<\/a>/);
  assert.match(html, /view=month&amp;month=2026-10/);
  assert.match(html, />Load next 7 days<\/button>/);
  assert.doesNotMatch(html, /Previous week|Next week|Week of|Saved plans|>Misc/);
});

test("Month keeps month navigation, opens single dishes directly and offers a chooser for multiple dishes", () => {
  const recipe = { dishId: "dish-1", dishName: "Soup", dishImageUrl: null, freeformText: null };
  const weeks = buildMonthCells({
    year: 2026, month0: 9, todayIso: "2026-10-30",
    entriesByIso: new Map([
      ["2026-10-30", [recipe]],
      ["2026-10-31", [recipe, { ...recipe, dishId: "dish-2", dishName: "Curry" }]],
      ["2026-11-01", [{ ...recipe, dishId: null, dishName: null, freeformText: "Takeout" }]],
    ]),
  });
  assert.equal(weeks.length, 6);
  assert.ok(weeks.every((week) => week.length === 7));
  const html = renderToStaticMarkup(createElement(PlanMonth, {
    weeks, monthLabel: "October 2026", monthParam: "2026-10",
    prevMonth: "2026-09", nextMonth: "2026-11",
  }));
  assert.match(html, /aria-label="Previous month"/);
  assert.match(html, /aria-label="Next month"/);
  const singleDishLink = html.match(/<a[^>]*aria-label="View Soup on 2026-10-30"[^>]*>/)?.[0];
  assert.match(singleDishLink ?? "", /href="\/dishes\/dish-1"/);
  assert.match(html, /aria-label="Choose a dish for 2026-10-31"/);
  assert.match(html, /Takeout/);
  assert.doesNotMatch(html, /view=week|week=|Choose a dish for 2026-11-01/);
});

test("meal-page schema requires seven days and valid entry metadata", () => {
  const page = { ...buildMealDays("2026-10-30"), grid: {} };
  assert.deepEqual(mealDaysPageSchema.parse(page), page);
  assert.equal(mealDaysPageSchema.safeParse({ ...page, days: page.days.slice(0, 6) }).success, false);
});

test("incremental requests use an uncached, abortable, bounded seven-day endpoint", async (t) => {
  const page = { ...buildMealDays("2026-11-06"), grid: {} };
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/meals?start=2026-11-06");
    assert.equal(options.cache, "no-store");
    assert.equal(options.signal, controller.signal);
    return Response.json(page);
  });
  assert.deepEqual(await fetchMealDays("2026-11-06", controller.signal), { page });
});

test("failed requests report retryable errors and expired sessions explicitly", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 500 }));
  const signal = new AbortController().signal;
  assert.deepEqual(await fetchMealDays("2026-11-06", signal), {
    error: "Could not load more days. Please try again.",
  });
  fetchMock.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  assert.deepEqual(await fetchMealDays("2026-11-06", signal), {
    error: "Your session expired. Sign in again to load more days.",
  });
});

test("unexpected page dates fail instead of silently appending overlapping or skipped days", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    ...buildMealDays("2026-11-13"), grid: {},
  }));
  await assert.rejects(fetchMealDays("2026-11-06", new AbortController().signal), /unexpected date range/);
});
