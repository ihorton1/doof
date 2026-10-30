import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayView } from "../src/app/(app)/today/today-view";

type Props = Parameters<typeof TodayView>[0];
type Entry = Props["days"][number]["entries"][number];

function renderToday(entries: Entry[]) {
  const days = [
    { iso: "2026-10-29", label: "Yesterday", isToday: false, isFocus: false, entries },
    { iso: "2026-10-30", label: "Today", isToday: true, isFocus: true, entries },
    { iso: "2026-10-31", label: "Tomorrow", isToday: false, isFocus: false, entries: [] },
  ];
  return renderToStaticMarkup(createElement(TodayView, {
    days,
    focusIso: "2026-10-30",
    prevFocusIso: "2026-10-29",
    nextFocusIso: "2026-10-31",
  }));
}

const dish: Entry = {
  id: "entry-1",
  dishId: "dish-1",
  dishName: "Crispy chilli eggs",
  dishImageUrl: "/api/dishes/dish-1/image",
  dishTags: ["fast", "vegetarian"],
  freeformText: null,
  status: "planned",
};

test("Today cards render separate photos, recipe headings and tag pills", () => {
  const html = renderToday([dish]);
  assert.match(html, /<article/);
  assert.match(html, /src="\/api\/dishes\/dish-1\/image"/);
  assert.match(html, /<h3><a[^>]*href="\/dishes\/dish-1"[^>]*>Crispy chilli eggs<\/a><\/h3>/);
  assert.match(html, /aria-label="Recipe tags"/);
  assert.match(html, />fast<\/li>/);
  assert.match(html, />vegetarian<\/li>/);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
});

test("Today preserves multiple meals, freeform meals and skipped styling without images or tags", () => {
  const html = renderToday([
    dish,
    { ...dish, id: "entry-2", dishId: null, dishName: null, dishImageUrl: null, dishTags: [], freeformText: "Leftovers", status: "skipped" },
  ]);
  assert.match(html, /Crispy chilli eggs/);
  assert.match(html, /line-through opacity-60[^>]*>Leftovers<\/span>/);
  assert.doesNotMatch(html, /src="null"/);
});

test("empty days retain planning links and desktop day navigation", () => {
  const html = renderToday([]);
  assert.match(html, /Nothing planned/);
  assert.match(html, /href="\/meals"/);
  assert.match(html, /Plan dinner/);
  assert.match(html, /aria-label="Previous day"/);
  assert.match(html, /aria-label="Next day"/);
  assert.match(html, /href="\/today\?d=2026-10-29"/);
});

test("day labels are centred above cards without visible ISO dates", () => {
  const html = renderToday([dish]);
  assert.match(html, /<h2 class="[^"]*text-center[^"]*[^>]*>Today<\/h2>/);
  assert.doesNotMatch(html, />2026-10-(?:29|30|31)</);
  assert.ok(html.indexOf(">Today</h2>") < html.indexOf('aria-label="Today meals"'));
});

test("multiple meals have individual snap cards and leave room for the next-card peek", () => {
  const html = renderToday([dish, { ...dish, id: "entry-2", dishName: "Soup" }]);
  assert.match(html, /auto-rows-\[minmax\(90%,auto\)\]/);
  assert.match(html, /snap-y snap-proximity/);
  assert.match(html, /<article aria-label="Crispy chilli eggs" class="[^"]*snap-start[^"]*rounded-\[2rem\]/);
  assert.match(html, /<article aria-label="Soup"/);
});

test("single meals fill the available carousel height", () => {
  const html = renderToday([dish]);
  assert.match(html, /auto-rows-\[minmax\(100%,auto\)\]/);
  assert.doesNotMatch(html, /auto-rows-\[minmax\(90%,auto\)\]/);
});

test("all day labels share the recipe titles' bold emerald typography", () => {
  const html = renderToday([dish]);
  const headings = [...html.matchAll(/<h2 class="([^"]+)">([^<]+)<\/h2>/g)];
  assert.ok(headings.length > 0);
  for (const [, classes] of headings) {
    for (const token of [
      "text-3xl", "md:text-xl", "font-extrabold", "leading-tight",
      "tracking-tight", "text-emerald-800", "dark:text-emerald-300", "text-center",
    ]) {
      assert.ok(classes.split(" ").includes(token), `Missing heading style: ${token}`);
    }
  }
});
