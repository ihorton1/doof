import assert from "node:assert/strict";
import { test } from "node:test";
import { rankPlanDishes } from "../src/lib/plan-recommendations";

const today = "2026-10-30";
type Entry = Parameters<typeof rankPlanDishes>[1][number];
const entry = (dishId: string | null, date: string, status = "planned"): Entry => ({ dishId, date, status });
const dishes = (...ids: string[]) => ids.map(id => ({ id, name: id }));
const ids = (result: { id: string }[]) => result.map(dish => dish.id);

test("eligible favourites lead, cooldown dishes follow, and upcoming dishes come last", () => {
  const result = rankPlanDishes(dishes("recent", "untried", "favourite", "upcoming"), [
    entry("favourite", "2026-10-01"), entry("favourite", "2026-09-01"),
    entry("recent", "2026-10-29"), entry("upcoming", today),
    entry("upcoming", "2026-09-01"), entry("upcoming", "2026-09-02"),
    entry("upcoming", "2026-09-03"),
  ], today);
  assert.deepEqual(ids(result), ["favourite", "untried", "recent", "upcoming"]);
});

test("frequency counts distinct non-skipped planned days within the rolling 90-day window", () => {
  const result = rankPlanDishes(dishes("frequent", "duplicate-rows", "old-favourite"), [
    entry("frequent", "2026-10-01"), entry("frequent", "2026-09-01"),
    entry("duplicate-rows", "2026-10-01"), entry("duplicate-rows", "2026-10-01"),
    entry("duplicate-rows", "2026-10-01"), entry("duplicate-rows", "2026-10-02", "skipped"),
    entry("old-favourite", "2026-01-01"), entry("old-favourite", "2026-01-02"),
    entry("old-favourite", "2026-01-03"),
  ], today);
  assert.deepEqual(ids(result), ["frequent", "duplicate-rows", "old-favourite"]);
});

test("unmarked past plan entries count as history; no cooked flag or timestamp is required", () => {
  assert.deepEqual(ids(rankPlanDishes(dishes("untried", "familiar"), [
    entry("familiar", "2026-10-01"),
  ], today)), ["familiar", "untried"]);
});

test("one untried recipe is inserted after every three eligible familiar dishes", () => {
  const known = dishes("a", "b", "c", "d", "e", "f");
  const unseen = dishes("new-a", "new-b");
  const result = rankPlanDishes([...known, ...unseen], known.map(d => entry(d.id, "2026-10-01")), today);
  assert.ok(result[3].id.startsWith("new-"));
  assert.ok(result[7].id.startsWith("new-"));
  assert.equal(result.filter(d => d.id.startsWith("new-")).length, 2);
  assert.equal(new Set(ids(result)).size, 8);
});

test("all recipes remain available when either recommendation pool is short or absent", () => {
  for (const [recipes, history] of [
    [dishes("a", "b", "c"), []],
    [dishes("a"), [entry("a", "2026-10-01")]],
    [dishes("a", "b", "new-a", "new-b"), [entry("a", "2026-10-01"), entry("b", "2026-10-02")]],
    [dishes("recent-a", "recent-b"), [entry("recent-a", "2026-10-29"), entry("recent-b", "2026-10-28")]],
  ] as const) {
    const result = rankPlanDishes([...recipes], [...history], today);
    assert.deepEqual(ids(result).sort(), recipes.map(d => d.id).sort());
    assert.equal(new Set(ids(result)).size, recipes.length);
  }
  assert.deepEqual(rankPlanDishes([], [], today), []);
});

test("14-day cooldown includes its boundary and fills oldest-planned first", () => {
  const result = rankPlanDishes(dishes("yesterday", "boundary", "eligible"), [
    entry("yesterday", "2026-10-29"),
    entry("boundary", "2026-10-16"),
    entry("eligible", "2026-10-15"),
  ], today);
  assert.deepEqual(ids(result), ["eligible", "boundary", "yesterday"]);
});

test("90-day frequency boundary is inclusive but older plans still count as tried", () => {
  const result = rankPlanDishes(dishes("too-old", "boundary", "untried"), [
    entry("too-old", "2026-07-31"), entry("boundary", "2026-08-01"),
  ], today);
  assert.deepEqual(ids(result), ["boundary", "too-old", "untried"]);
});

test("cooldown uses calendar days across daylight saving and year boundaries", () => {
  for (const [day, boundary, older] of [
    ["2026-03-30", "2026-03-16", "2026-03-15"],
    ["2027-01-05", "2026-12-22", "2026-12-21"],
  ]) {
    assert.deepEqual(ids(rankPlanDishes(dishes("recent", "eligible"), [
      entry("recent", boundary), entry("eligible", older),
    ], day)), ["eligible", "recent"]);
  }
});

test("past and future skipped entries neither trigger cooldown nor suppress discovery", () => {
  const baseline = rankPlanDishes(dishes("a", "b", "c"), [], today);
  const skipped = [
    entry("a", "2026-10-29", "skipped"),
    entry("b", "2026-11-02", "skipped"),
    entry("c", "2026-10-01", "skipped"),
  ];
  assert.deepEqual(rankPlanDishes(dishes("a", "b", "c"), skipped, today), baseline);
});

test("today and all future dates are upcoming, not past history", () => {
  const result = rankPlanDishes(dishes("future-only", "today-only", "untried", "familiar"), [
    entry("future-only", "2027-01-01"), entry("today-only", today),
    entry("familiar", "2026-10-01"),
  ], today);
  assert.deepEqual(ids(result).slice(0, 2), ["familiar", "untried"]);
  assert.deepEqual(ids(result).slice(2).sort(), ["future-only", "today-only"]);
});

test("daily ranking is repeatable and independent of database input ordering", () => {
  const recipes = dishes(...Array.from({ length: 20 }, (_, i) => `dish-${i}`));
  const history = recipes.map(d => entry(d.id, "2026-10-01"));
  const ranked = rankPlanDishes(recipes, history, today);
  assert.deepEqual(rankPlanDishes(recipes, history, today), ranked);
  assert.deepEqual(rankPlanDishes([...recipes].reverse(), [...history].reverse(), today), ranked);
  assert.notDeepEqual(ids(rankPlanDishes(recipes, history, "2026-10-31")), ids(ranked));
});

test("daily shuffle also varies the discovery pool", () => {
  const recipes = dishes(...Array.from({ length: 20 }, (_, i) => `new-${i}`));
  assert.notDeepEqual(
    ids(rankPlanDishes(recipes, [], today)),
    ids(rankPlanDishes(recipes, [], "2026-10-31")),
  );
});

test("deleted or unrelated dishes and freeform plan entries do not affect recommendations", () => {
  const recipes = dishes("a", "b");
  assert.deepEqual(rankPlanDishes(recipes, [
    entry(null, "2026-10-29"), entry("not-in-catalogue", today),
  ], today), rankPlanDishes(recipes, [], today));
});

test("ranking preserves dish metadata and does not mutate dishes or history", () => {
  const recipe = { id: "dish-a", name: "Soup", tags: ["quick"], imageUrl: "/image" };
  const recipes = [recipe, { ...recipe, id: "dish-b" }];
  const history = [entry("dish-a", "2026-10-01")];
  const before = structuredClone({ recipes, history });
  const result = rankPlanDishes(recipes, history, today);
  assert.equal(result[0], recipe);
  assert.deepEqual({ recipes, history }, before);
});
