-- Keep previously expired leftovers hidden when extending retention to ten days.
UPDATE "MealPlanEntry"
SET "leftoversDismissed" = true
WHERE "mealSlot" = 'dinner'
  AND "dishId" IS NOT NULL
  AND "leftoversDismissed" = false
  AND "date" >= CURRENT_DATE - INTERVAL '10 days'
  AND "date" < CURRENT_DATE - INTERVAL '4 days';
