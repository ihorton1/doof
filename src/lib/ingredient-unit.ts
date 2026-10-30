const unitAliases = new Map<string, string>();

const unitGroups: Record<string, string[]> = {
  tbsp: ["tbsp", "tbs", "tbsps", "tablespoon", "tablespoons"],
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons"],
  g: ["g", "gram", "grams", "gramme", "grammes"],
  kg: ["kg", "kgs", "kilogram", "kilograms", "kilogramme", "kilogrammes"],
  mg: ["mg", "milligram", "milligrams", "milligramme", "milligrammes"],
  ml: ["ml", "mls", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "lt", "ltr", "ltrs", "liter", "liters", "litre", "litres"],
  oz: ["oz", "ounce", "ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  in: ["in", "inch", "inches"],
  cm: ["cm", "cms", "centimeter", "centimeters", "centimetre", "centimetres"],
  mm: ["mm", "mms", "millimeter", "millimeters", "millimetre", "millimetres"],
  cup: ["cup", "cups"],
  clove: ["clove", "cloves"],
  tin: ["tin", "tins"],
};

for (const [unit, aliases] of Object.entries(unitGroups)) {
  for (const alias of aliases) unitAliases.set(alias, unit);
}

export function normalizeIngredientUnit(value: string): string | null {
  const unit = value.trim().toLowerCase();
  if (!unit) return null;
  return unitAliases.get(unit.replace(/\.$/, "")) ?? unit;
}
