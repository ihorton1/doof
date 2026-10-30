import { redirect } from "next/navigation";
import { SavedDishes } from "./saved-dishes";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: {
  searchParams: Promise<{ week?: string; month?: string; view?: string }>;
}) {
  const params = await searchParams;
  const legacy = new URLSearchParams();
  for (const key of ["week", "month", "view"] as const) {
    if (params[key]) legacy.set(key, params[key]);
  }
  if (legacy.size > 0) redirect(`/meals?${legacy.toString()}`);
  return <SavedDishes />;
}
