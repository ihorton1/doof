"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { dishTagSchema, type AddDishTagAction } from "@/lib/dish-tags";

export const addDishTag: AddDishTagAction = async (input) => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) return { error: "Sign in again before adding a tag." };

  const parsed = dishTagSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a dish and enter a tag between 1 and 40 characters." };
  const { dishId, tag: name } = parsed.data;

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const dish = await tx.dish.findUnique({ where: { id: dishId }, select: { id: true } });
        if (!dish) return { error: "This dish no longer exists. Refresh your saved dishes." };

        const tag = await tx.tag.upsert({
          where: { name },
          create: { name },
          update: {},
          select: { id: true, name: true },
        });
        const where = { dishId_tagId: { dishId, tagId: tag.id } };
        const existing = await tx.dishTag.findUnique({ where });
        if (existing) return { status: "already-tagged", tag: tag.name } as const;

        await tx.dishTag.create({ data: { dishId, tagId: tag.id } });
        return { status: "added", tag: tag.name } as const;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ("status" in result) {
        revalidatePath("/plan");
        revalidatePath("/dishes");
        revalidatePath(`/dishes/${dishId}`);
        revalidatePath(`/dishes/${dishId}/edit`);
        revalidatePath("/today");
        revalidatePath("/meals");
      }
      return result;
    } catch (error) {
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002")) continue;
      console.error("Failed to add a recipe tag", error);
      return { error: "Could not add this tag. Please try again." };
    }
  }
};
