export const SNOOZE_DAYS = [1, 3, 7, 14, 30, 60] as const;
export const SCHEDULE_TIMEZONE = "Europe/London";

const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHEDULE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function snoozeDays(snoozeCount: number) {
  if (!Number.isInteger(snoozeCount) || snoozeCount < 0) {
    throw new Error("Bolts: snooze count must be a nonnegative integer.");
  }
  return SNOOZE_DAYS[Math.min(snoozeCount, SNOOZE_DAYS.length - 1)];
}

export function londonDayAfter(now: Date, days: number) {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(days) || days < 1) {
    throw new Error("Bolts: scheduling requires a valid date and a positive whole number of days.");
  }
  const parts = londonDate.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((value) => value.type === type)!.value);
  const target = Date.UTC(part("year"), part("month") - 1, part("day") + days);
  const localClock = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  });
  // London midnight is either 00:00 UTC or 23:00 UTC on the preceding day.
  return new Date(target - Number(localClock.format(new Date(target))) * 60 * 60 * 1000);
}
