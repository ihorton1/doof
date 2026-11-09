"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { setDishRatingSchema, type SetDishRatingAction } from "@/lib/dish-ratings";

export const setDishRating: SetDishRatingAction = async (input) => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) return { error: "Sign in again before rating a dish." };

  const parsed = setDishRatingSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a dish and a valid rating, or clear the rating." };
  const { dishId, rating } = parsed.data;

  try {
    const result = await prisma.dish.updateMany({
      where: { id: dishId },
      data: { rating },
    });
    if (result.count === 0) return { error: "This dish no longer exists. Refresh your saved dishes." };

    revalidatePath("/dishes");
    revalidatePath(`/dishes/${dishId}`);
    revalidatePath(`/dishes/${dishId}/edit`);
    revalidatePath("/today");
    revalidatePath("/plan");
    return { rating };
  } catch (error) {
    console.error("Failed to save dish rating", error);
    return { error: "Could not save this rating. Please try again." };
  }
};
