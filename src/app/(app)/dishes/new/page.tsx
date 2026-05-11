import { DishForm } from "../dish-form";
import { createDish } from "../actions";
import { getIngredientSuggestions } from "@/lib/ingredient-suggestions";

export const dynamic = "force-dynamic";

export default async function NewDishPage() {
  const suggestions = await getIngredientSuggestions();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New dish</h1>
      <DishForm action={createDish} suggestions={suggestions} />
    </div>
  );
}
