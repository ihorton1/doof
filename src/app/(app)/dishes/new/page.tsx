import { DishForm } from "../dish-form";
import { createDish } from "../actions";
import { getIngredientSuggestions } from "@/lib/ingredient-suggestions";
import { getTagSuggestions } from "@/lib/tag-suggestions";

export const dynamic = "force-dynamic";

export default async function NewDishPage() {
  const [ingredient, tags] = await Promise.all([
    getIngredientSuggestions(),
    getTagSuggestions(),
  ]);
  const suggestions = { ...ingredient, tags };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New dish</h1>
      <DishForm action={createDish} suggestions={suggestions} />
    </div>
  );
}
