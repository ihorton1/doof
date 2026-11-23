import { NewDishForm } from "./new-dish-form";
import { getIngredientSuggestions } from "@/lib/ingredient-suggestions";
import { getTagSuggestions } from "@/lib/tag-suggestions";

export const dynamic = "force-dynamic";

export default async function NewDishPage({ searchParams }: {
  searchParams: Promise<{ peek?: string }>;
}) {
  const { peek } = await searchParams;
  const [ingredient, tags] = await Promise.all([
    getIngredientSuggestions(),
    getTagSuggestions(),
  ]);
  const suggestions = { ...ingredient, tags };
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New dish</h1>
      <NewDishForm key={peek ?? "manual"} peekId={peek} suggestions={suggestions} />
    </div>
  );
}
