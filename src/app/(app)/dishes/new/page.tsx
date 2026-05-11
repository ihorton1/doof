import { DishForm } from "../dish-form";
import { createDish } from "../actions";

export default function NewDishPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New dish</h1>
      <DishForm action={createDish} />
    </div>
  );
}
