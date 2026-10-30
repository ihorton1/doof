import assert from "node:assert/strict";
import { test } from "node:test";
import { getPlanningDays, isPlanningDay } from "../src/lib/planning-days";

test("day picker has exactly 30 consecutive days beginning with today and tomorrow", () => {
  const days = getPlanningDays("2026-10-30");
  assert.equal(days.length, 30);
  assert.deepEqual(days[0], { iso: "2026-10-30", label: "Today" });
  assert.deepEqual(days[1], { iso: "2026-10-31", label: "Tomorrow" });
  assert.equal(days[2].iso, "2026-11-01");
  assert.equal(days[29].iso, "2026-11-28");
  assert.equal(new Set(days.map(day => day.iso)).size, 30);
});

test("planning range handles leap days, daylight saving and year boundaries", () => {
  for (const [today, tomorrow, last] of [
    ["2028-02-28", "2028-02-29", "2028-03-28"],
    ["2026-03-28", "2026-03-29", "2026-04-26"],
    ["2026-12-31", "2027-01-01", "2027-01-29"],
  ]) {
    const days = getPlanningDays(today);
    assert.equal(days[1].iso, tomorrow);
    assert.equal(days[29].iso, last);
  }
});

test("server validation accepts only real dates within the displayed range", () => {
  for (const day of getPlanningDays("2026-10-30")) assert.equal(isPlanningDay(day.iso, "2026-10-30"), true);
  for (const invalid of ["2026-10-29", "2026-11-29", "2026-02-30", "2026-13-01", "not-a-date", "2026-10-30T00:00:00Z", ""]) {
    assert.equal(isPlanningDay(invalid, "2026-10-30"), false, invalid);
  }
});
