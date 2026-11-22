"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { fromISODate, getWeekStart } from "@/lib/utils";

export type RescheduleMealAction = (input: { entryId: string; date: string }) => Promise<
  { status: "rescheduled" } | { error: string }
>;

const schema = z.object({
  entryId: z.string().trim().min(1).max(200),
  date: z.iso.date(),
});

export const rescheduleMeal: RescheduleMealAction = async (input) => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) return { error: "Sign in again before rescheduling a meal." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Choose a meal and a valid date." };
  const { entryId, date: iso } = parsed.data;
  const date = fromISODate(iso);

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const entry = await tx.mealPlanEntry.findUnique({ where: { id: entryId } });
        if (!entry || entry.mealSlot !== "dinner") {
          return { error: "This meal is no longer available. Refresh Today." };
        }
        if (entry.date.getTime() === date.getTime()) return { status: "rescheduled" } as const;

        if (entry.dishId) {
          const duplicate = await tx.mealPlanEntry.findFirst({
            where: { dishId: entry.dishId, date, mealSlot: entry.mealSlot },
            select: { id: true },
          });
          if (duplicate) return { error: "This dish is already planned for that day. Choose another date." };
          const count = await tx.mealPlanEntry.count({
            where: { date, mealSlot: entry.mealSlot, dishId: { not: null } },
          });
          if (count >= 50) return { error: "This day already has 50 dishes. Remove one in Meals first." };
        }

        const weekStartDate = getWeekStart(date);
        const plan = await tx.mealPlan.upsert({
          where: { weekStartDate },
          create: { weekStartDate },
          update: {},
          select: { id: true },
        });
        await tx.mealPlanEntry.update({
          where: { id: entryId },
          data: { date, mealPlanId: plan.id },
        });
        return { status: "rescheduled" } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ("status" in result) {
        revalidatePath("/today");
        revalidatePath("/meals");
        revalidatePath("/plan");
        revalidatePath("/shop");
        revalidatePath("/dishes", "layout");
      }
      return result;
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")) continue;
      console.error("Failed to reschedule meal", error);
      return { error: "Could not reschedule this meal. Please try again." };
    }
  }
};
