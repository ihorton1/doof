"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isPlanningDay } from "@/lib/planning-days";
import { fromISODate, getWeekStart, toISODate } from "@/lib/utils";

const selectionSchema = z.object({
  dishId: z.string().min(1).max(100),
  date: z.iso.date(),
});

export async function chooseDish(input: { dishId: string; date: string }): Promise<
  { status: "added" | "already-planned" } | { error: string }
> {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) return { error: "Sign in again before adding a meal." };

  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success || !isPlanningDay(parsed.data.date, toISODate(new Date()))) {
    return { error: "Choose a valid day within the next 30 days." };
  }
  const { dishId, date: iso } = parsed.data;
  const date = fromISODate(iso);

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const dish = await tx.dish.findUnique({ where: { id: dishId }, select: { id: true } });
        if (!dish) return { error: "This dish no longer exists. Refresh your saved dishes." };

        const existing = await tx.mealPlanEntry.findFirst({
          where: { dishId, date, mealSlot: "dinner" },
          select: { id: true },
        });
        if (existing) return { status: "already-planned" } as const;

        const count = await tx.mealPlanEntry.count({
          where: { date, mealSlot: "dinner", dishId: { not: null } },
        });
        if (count >= 50) return { error: "This day already has 50 dishes. Remove one in Meals first." };

        const plan = await tx.mealPlan.upsert({
          where: { weekStartDate: getWeekStart(date) },
          create: { weekStartDate: getWeekStart(date) },
          update: {},
          select: { id: true },
        });
        await tx.mealPlanEntry.create({
          data: { mealPlanId: plan.id, date, mealSlot: "dinner", dishId },
        });
        return { status: "added" } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ("status" in result) {
        revalidatePath("/plan");
        revalidatePath("/meals");
        revalidatePath("/today");
        revalidatePath("/dishes");
        revalidatePath("/shop");
      }
      return result;
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")) continue;
      console.error("Failed to add a saved dish to meals", error);
      return { error: "Could not add this dish. Please try again." };
    }
  }
}
