import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getLeftovers, getLeftoverWindow, isLeftoverSwipe } from "../src/lib/leftovers";
import { fromISODate, toISODate } from "../src/lib/utils";
import { LeftoversView } from "../src/app/(app)/today/leftovers-view";

function entry(id: string, date: string) {
  return {
    id,
    date: fromISODate(date),
    mealSlot: "dinner",
    status: "planned",
    leftoversDismissed: false,
    dishImageUrl: null,
    dish: { id: "dish-1", name: "Roast vegetables" },
  };
}

test("the four past calendar days have four, three, two and one days remaining", () => {
  const leftovers = getLeftovers([
    entry("yesterday", "2026-11-08"),
    entry("two-days", "2026-11-07"),
    entry("three-days", "2026-11-06"),
    entry("four-days", "2026-11-05"),
    entry("expired", "2026-11-04"),
    entry("today", "2026-11-09"),
    entry("future", "2026-11-10"),
  ], "2026-11-09");
  assert.deepEqual(leftovers.map(({ entryId, day, daysRemaining }) => ({
    entryId, day, daysRemaining,
  })), [
    { entryId: "expired", day: 5, daysRemaining: 0 },
    { entryId: "four-days", day: 4, daysRemaining: 1 },
    { entryId: "three-days", day: 3, daysRemaining: 2 },
    { entryId: "two-days", day: 2, daysRemaining: 3 },
    { entryId: "yesterday", day: 1, daysRemaining: 4 },
  ]);
});

test("dismissed, skipped, non-dinner and missing recipes do not appear", () => {
  const base = entry("base", "2026-11-08");
  assert.deepEqual(getLeftovers([
    { ...base, leftoversDismissed: true },
    { ...base, status: "skipped" },
    { ...base, mealSlot: "lunch" },
    { ...base, dish: null },
  ], "2026-11-09"), []);
  assert.equal(getLeftovers([{ ...base, status: "cooked" }], "2026-11-09").length, 1);
});

test("dismissal is per meal occurrence, not per dish", () => {
  const leftovers = getLeftovers([
    { ...entry("older", "2026-11-07"), leftoversDismissed: true },
    entry("newer", "2026-11-08"),
  ], "2026-11-09");
  assert.deepEqual(leftovers.map(({ entryId, dishId }) => ({ entryId, dishId })), [
    { entryId: "newer", dishId: "dish-1" },
  ]);
});

test("date windows cross month, year and daylight saving boundaries by calendar day", () => {
  for (const [today, oldest] of [
    ["2027-01-02", "2026-12-29"],
    ["2026-03-30", "2026-03-26"],
    ["2026-11-02", "2026-10-29"],
    ["2028-03-02", "2028-02-27"],
  ]) {
    assert.equal(getLeftovers([entry("oldest", oldest)], today)[0].day, 4);
  }
});

test("the ten-day query window crosses calendar and daylight saving boundaries", () => {
  for (const [today, oldest] of [
    ["2027-01-02", "2026-12-23"],
    ["2026-03-30", "2026-03-20"],
    ["2026-11-02", "2026-10-23"],
    ["2028-03-02", "2028-02-21"],
  ]) {
    const window = getLeftoverWindow(today);
    assert.equal(toISODate(window.gte), oldest);
    assert.equal(toISODate(window.lt), today);
    assert.equal(getLeftovers([entry("oldest", oldest)], today)[0].day, 10);
  }
});

test("yesterday advances and the fourth past day becomes expired at midnight", () => {
  const entries = [entry("oldest", "2026-11-05"), entry("newest", "2026-11-08")];
  assert.equal(getLeftovers(entries, "2026-11-09").length, 2);
  const nextDay = getLeftovers(entries, "2026-11-10");
  assert.deepEqual(nextDay.map(({ entryId, day, daysRemaining }) => ({
    entryId, day, daysRemaining,
  })), [
    { entryId: "oldest", day: 5, daysRemaining: 0 },
    { entryId: "newest", day: 2, daysRemaining: 3 },
  ]);
});

test("expired leftovers stay through day ten and fall off on day eleven", () => {
  const entries = [
    entry("ten-days", "2026-10-30"),
    entry("too-old", "2026-10-29"),
    entry("five-days", "2026-11-04"),
  ];
  assert.deepEqual(getLeftovers(entries, "2026-11-09").map(({ entryId, day, daysRemaining }) => ({
    entryId, day, daysRemaining,
  })), [
    { entryId: "ten-days", day: 10, daysRemaining: 0 },
    { entryId: "five-days", day: 5, daysRemaining: 0 },
  ]);
  assert.deepEqual(getLeftovers(entries, "2026-11-10").map(({ entryId }) => entryId), ["five-days"]);
});

test("previously hidden expired meals remain hidden after extending retention", () => {
  assert.deepEqual(getLeftovers([
    { ...entry("hidden", "2026-11-04"), leftoversDismissed: true },
    { ...entry("hidden-too", "2026-10-30"), leftoversDismissed: true },
  ], "2026-11-09"), []);
});

test("either horizontal direction can dismiss, but short drags and vertical scrolling cannot", () => {
  assert.equal(isLeftoverSwipe(80, 0), true);
  assert.equal(isLeftoverSwipe(-80, 0), true);
  assert.equal(isLeftoverSwipe(79, 0), false);
  assert.equal(isLeftoverSwipe(-79, 0), false);
  assert.equal(isLeftoverSwipe(100, 100), false);
  assert.equal(isLeftoverSwipe(0, 150), false);
  assert.equal(isLeftoverSwipe(90, 60), false);
  assert.equal(isLeftoverSwipe(90, 59), true);
});

function renderLeftovers(dates: string[], dishImageUrl: string | null = null) {
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} },
  }, createElement(LeftoversView, {
    leftovers: getLeftovers(dates.map((date, index) => ({
      ...entry(`entry-${index}`, date), dishImageUrl,
    })), "2026-11-09"),
    dismissAction: async () => ({ status: "dismissed" } as const),
    refreshAt: fromISODate("2026-11-10").getTime(),
  })));
}

test("freshness bars expose all four colors, exact remaining widths and accessible timing", () => {
  const html = renderLeftovers(["2026-11-08", "2026-11-07", "2026-11-06", "2026-11-05"]);
  for (const [color, width] of [
    ["emerald-500", 100], ["yellow-400", 75], ["orange-500", 50], ["red-500", 25],
  ]) assert.match(html, new RegExp(`class="[^"]*bg-${color}[^"]*" style="width:${width}%"`));
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 4);
  assert.match(html, /aria-valuenow="1" aria-valuetext="Day 4 of 4; last day"/);
  assert.match(html, /aria-valuenow="4" aria-valuetext="Day 1 of 4; 4 days left"/);
  assert.match(html, /Mark Roast vegetables leftovers as eaten/);
  assert.match(html, /touch-pan-y/);
  assert.match(html, /href="\/dishes\/dish-1"/);
  assert.doesNotMatch(html, /Timing is based on the planned date|not a food-safety guarantee/);
  assert.doesNotMatch(html, /A four-day reminder from past planned recipes/);
});

test("the planned date replaces the visible day counter below each freshness bar", () => {
  const html = renderLeftovers(["2026-11-07"]);
  const barPosition = html.indexOf('role="progressbar"');
  const datePosition = html.indexOf('<time dateTime="2026-11-07">Sat 7 Nov</time>');
  assert.ok(barPosition >= 0 && datePosition > barPosition);
  assert.equal((html.match(/<time /g) ?? []).length, 1);
  assert.doesNotMatch(html, /Planned/);
  assert.doesNotMatch(html, />Day 2 of 4</);
  assert.match(html, /aria-valuetext="Day 2 of 4; 3 days left"/);
});

test("days five through ten replace the freshness bar with an accessible vomiting emoji", () => {
  const html = renderLeftovers(["2026-11-04", "2026-10-30"]);
  assert.equal((html.match(/role="img" aria-label="Roast vegetables: expired leftovers"/g) ?? []).length, 2);
  assert.equal((html.match(/\u{1F92E}/gu) ?? []).length, 2);
  assert.equal((html.match(/>Expired<\/span>/g) ?? []).length, 2);
  assert.equal((html.match(/Mark Roast vegetables leftovers as eaten/g) ?? []).length, 2);
  assert.match(html, /dateTime="2026-11-04"/);
  assert.match(html, /dateTime="2026-10-30"/);
  assert.doesNotMatch(html, /role="progressbar"|days left|Last day|width:-|undefined/);
});

test("fresh and expired leftovers retain their separate indicators in the same list", () => {
  const html = renderLeftovers(["2026-11-08", "2026-11-04"]);
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 1);
  assert.equal((html.match(/\u{1F92E}/gu) ?? []).length, 1);
});

test("an empty leftovers section remains visible with guidance", () => {
  const html = renderLeftovers([]);
  assert.match(html, /id="leftovers-heading"/);
  assert.match(html, /No leftovers to keep track of/);
  assert.doesNotMatch(html, /role="progressbar"/);
});

test("saved recipe thumbnails are carried through and rendered as decorative lazy images", () => {
  const dishImageUrl = "/api/dishes/dish-1/image?v=123";
  const leftovers = getLeftovers([{ ...entry("photo", "2026-11-08"), dishImageUrl }], "2026-11-09");
  assert.equal(leftovers[0].dishImageUrl, dishImageUrl);
  const html = renderLeftovers(["2026-11-08"], dishImageUrl);
  assert.match(html, /<img[^>]*src="\/api\/dishes\/dish-1\/image\?v=123"/);
  assert.match(html, /alt="" width="56" height="56" loading="lazy"/);
  assert.match(html, /draggable="false" class="size-full object-cover"/);
  assert.doesNotMatch(html, /lucide-utensils-crossed/);
});

test("recipes without photos retain the same thumbnail space with a utensil placeholder", () => {
  const html = renderLeftovers(["2026-11-08"]);
  assert.match(html, /row-span-3 flex size-14/);
  assert.match(html, /lucide-utensils-crossed/);
  assert.doesNotMatch(html, /<img/);
});
