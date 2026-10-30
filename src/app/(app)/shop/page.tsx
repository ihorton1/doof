import { prisma } from "@/lib/prisma";
import { fromISODate, toISODate } from "@/lib/utils";
import { getRollingBox, requireShoppingSession, syncRollingShoppingList } from "@/lib/shopping-data";
import { ShopList } from "./shop-list";
import { ProduceBox } from "./produce-box";
import { getIngredientSuggestions } from "@/lib/ingredient-suggestions";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  await requireShoppingSession();
  const today = fromISODate(toISODate(new Date()));
  const [items, box, ingredientSuggestions] = await Promise.all([
    syncRollingShoppingList(today),
    getRollingBox(),
    getIngredientSuggestions(),
  ]);
  const boxItems = await prisma.produceBoxItem.findMany({
    where: { produceBoxId: box.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true, quantity: true, unit: true, carriedFromId: true, checked: true },
  });
  return (
    <div className="space-y-4">
      <ProduceBox suggestions={ingredientSuggestions} items={boxItems} />
      <ShopList items={items} />
    </div>
  );
}
