import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TodayView } from "../src/app/(app)/today/today-view";

type Props = Parameters<typeof TodayView>[0];
type Entry = Props["days"][number]["entries"][number];

function renderToday(entries: Entry[]) {
  const days = [
    { iso: "2026-10-29", label: "Yesterday", isToday: false, isFocus: false, entries },
    { iso: "2026-10-30", label: "Today", isToday: true, isFocus: true, entries },
    { iso: "2026-10-31", label: "Tomorrow", isToday: false, isFocus: false, entries: [] },
  ];
  const view = createElement(TodayView, {
    days,
    focusIso: "2026-10-30",
    prevFocusIso: "2026-10-29",
    nextFocusIso: "2026-10-31",
    addTagAction: async ({ tag }) => ({ status: "added", tag } as const),
    setRatingAction: async ({ rating }) => ({ rating }),
    tagSuggestions: ["fast", "vegetarian", "lyse friendly"],
    leftovers: [],
    dismissLeftoversAction: async () => ({ status: "dismissed" } as const),
    leftoversRefreshAt: new Date("2026-10-31").getTime(),
  });
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: {
      back() {}, forward() {}, refresh() {},
      push() {}, replace() {}, prefetch() {},
    },
  }, view));
}

const dish: Entry = {
  id: "entry-1",
  dishId: "dish-1",
  dishName: "Crispy chilli eggs",
  dishRating: null,
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
  assert.match(html, /aria-label="Recipe rating and tags"/);
  assert.match(html, />fast<\/li>/);
  assert.match(html, />vegetarian<\/li>/);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/);
});

test("saved meals offer editable ratings, with read-only badges inside linked adjacent days", () => {
  const html = renderToday([{ ...dish, dishRating: "yum" }]);
  assert.match(html, /aria-label="Change rating for Crispy chilli eggs: yum"/);
  assert.match(html, /aria-label="Rating: yum"/);
  assert.match(html, /data-rating-control="true"/);
  assert.match(html, /<ul aria-label="Recipe rating and tags"[^>]*><li><div data-rating-control/);
  assert.match(html, /<ul aria-label="Recipe rating and tags"[^>]*><li><span aria-label="Rating: yum"/);
  assert.ok(html.indexOf("data-rating-control") < html.indexOf(">fast</li>"));
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/);
  assert.doesNotMatch(html, /<dialog/);
});

test("unrated meals offer Rate dish, while freeform meals have no rating control", () => {
  assert.match(renderToday([dish]), />Rate dish<\/span>/);
  const html = renderToday([{ ...dish, dishId: null, dishName: null, dishTags: [], freeformText: "Takeaway" }]);
  assert.doesNotMatch(html, /data-rating-control|Rating:|Rate dish/);
  assert.doesNotMatch(html, /Recipe rating and tags/);
});

test("saved meals without tags retain their rating controls without empty tag rows in linked unrated cards", () => {
  const html = renderToday([{ ...dish, dishTags: [] }]);
  assert.match(html, /<ul aria-label="Recipe rating and tags"[^>]*><li><div data-rating-control/);
  assert.doesNotMatch(html, /<ul aria-label="Recipe rating and tags"[^>]*><\/ul>/);
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
  assert.match(html, /<article aria-label="Crispy chilli eggs"[^>]*class="[^"]*snap-start[^"]*rounded-\[2rem\]/);
  assert.match(html, /<article aria-label="Soup"/);
});

test("saved dishes offer triple-tap tagging and a keyboard alternative without tagging freeform meals", () => {
  const html = renderToday([
    dish,
    { ...dish, id: "entry-2", dishId: null, dishName: null, dishImageUrl: null, dishTags: [], freeformText: "Leftovers" },
  ]);
  assert.match(html, /Triple-tap a dish to add a tag/);
  assert.match(html, /data-tag-dish="dish-1" tabindex="0" aria-keyshortcuts="t" aria-describedby="today-tag-help"/);
  assert.match(html, /<article aria-label="Leftovers" class=/);
  assert.doesNotMatch(html, /data-tag-dish="null"/);
  assert.doesNotMatch(html, /<dialog/);
});

test("single meals fill the available carousel height", () => {
  const html = renderToday([dish]);
  assert.match(html, /auto-rows-\[minmax\(100%,auto\)\]/);
  assert.doesNotMatch(html, /auto-rows-\[minmax\(90%,auto\)\]/);
});

test("leftovers appear below both recipe layouts rather than inside the day carousel", () => {
  const html = renderToday([dish]);
  assert.ok(html.indexOf('id="leftovers-heading"') > html.lastIndexOf('aria-label="Next day"'));
  assert.match(html, /No leftovers to keep track of/);
  assert.doesNotMatch(html, /overscroll-y-contain/);
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
