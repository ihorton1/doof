import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReschedulePicker } from "../src/app/(app)/today/reschedule-picker";

function render(date: string) {
  return renderToStaticMarkup(createElement(ReschedulePicker, {
    meal: { id: "meal-1", name: "Soup", date },
    todayIso: "2026-11-22",
    rescheduleAction: async () => ({ status: "rescheduled" } as const),
    onClose() {},
    onSaved() {},
  }));
}

test("rescheduling reuses the scroll listbox with fifteen options and no native date input", () => {
  const html = render("2026-11-19");
  assert.match(html, /role="listbox" aria-label="Day to cook"/);
  assert.match(html, /snap-y snap-mandatory/);
  assert.equal([...html.matchAll(/role="option"/g)].length, 15);
  assert.match(html, /id="reschedule-day-2026-11-15"/);
  assert.match(html, /id="reschedule-day-2026-11-29"/);
  assert.match(html, /aria-activedescendant="reschedule-day-2026-11-19"/);
  assert.match(html, /id="reschedule-day-2026-11-19" role="option" aria-selected="true"/);
  assert.doesNotMatch(html, /<input|type="date"/);
  assert.match(html, /Leftover time is recalculated from this date/);
});

test("out-of-range meals start on Today and explicitly explain the current date", () => {
  const html = render("2026-10-01");
  assert.match(html, /aria-activedescendant="reschedule-day-2026-11-22"/);
  assert.match(html, /current meal date \(2026-10-01\) is outside this range/);
  assert.equal([...html.matchAll(/aria-selected="true"/g)].length, 1);
});
