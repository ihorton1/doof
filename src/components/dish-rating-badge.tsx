import { dishRatingClasses, type DishRating } from "@/lib/dish-ratings";

export function DishRatingBadge({ rating }: { rating: DishRating | null }) {
  if (!rating) return null;
  return (
    <span
      aria-label={`Rating: ${rating}`}
      className={`inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${dishRatingClasses[rating]}`}
    >
      {rating}
    </span>
  );
}
