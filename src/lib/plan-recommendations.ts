import { addDays, fromISODate, toISODate } from "./utils";

type PlanHistory = {
  dishId: string | null;
  date: string;
  status: string;
};

function dailyOrder(day: string, id: string): number {
  let hash = 2166136261;
  for (const character of `${day}:${id}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function rankPlanDishes<T extends { id: string }>(
  dishes: T[],
  history: PlanHistory[],
  todayIso: string,
): T[] {
  const today = fromISODate(todayIso);
  const cooldownStart = toISODate(addDays(today, -14));
  const frequencyStart = toISODate(addDays(today, -90));
  const usage = new Map(dishes.map(dish => [
    dish.id, { pastDays: new Set<string>(), upcoming: false },
  ]));

  for (const entry of history) {
    if (!entry.dishId || entry.status === "skipped") continue;
    const stats = usage.get(entry.dishId);
    if (!stats) continue;
    if (entry.date >= todayIso) stats.upcoming = true;
    else stats.pastDays.add(entry.date);
  }

  const ranked = dishes.map(dish => {
    const stats = usage.get(dish.id)!;
    let lastPlanned: string | null = null;
    let frequency = 0;
    for (const date of stats.pastDays) {
      if (lastPlanned === null || date > lastPlanned) lastPlanned = date;
      if (date >= frequencyStart) frequency++;
    }
    return {
      dish,
      lastPlanned,
      frequency,
      order: dailyOrder(todayIso, dish.id),
      tier: stats.upcoming ? "upcoming"
        : lastPlanned === null ? "untried"
        : lastPlanned >= cooldownStart ? "cooldown" : "familiar",
    };
  });

  type Ranked = (typeof ranked)[number];
  const comparePopularity = (a: Ranked, b: Ranked) =>
    b.frequency - a.frequency || a.order - b.order ||
    (a.dish.id < b.dish.id ? -1 : a.dish.id > b.dish.id ? 1 : 0);

  const familiar = ranked.filter(item => item.tier === "familiar").sort(comparePopularity);
  const untried = ranked.filter(item => item.tier === "untried").sort(comparePopularity);
  const cooldown = ranked.filter(item => item.tier === "cooldown").sort((a, b) => {
    if (a.lastPlanned && b.lastPlanned && a.lastPlanned !== b.lastPlanned) {
      return a.lastPlanned < b.lastPlanned ? -1 : 1;
    }
    return comparePopularity(a, b);
  });
  const upcoming = ranked.filter(item => item.tier === "upcoming").sort(comparePopularity);

  const suggestions: Ranked[] = [];
  let familiarIndex = 0;
  let untriedIndex = 0;
  while (familiarIndex < familiar.length || untriedIndex < untried.length) {
    for (let count = 0; count < 3 && familiarIndex < familiar.length; count++) {
      suggestions.push(familiar[familiarIndex++]);
    }
    if (untriedIndex < untried.length) suggestions.push(untried[untriedIndex++]);
  }
  return [...suggestions, ...cooldown, ...upcoming].map(item => item.dish);
}
