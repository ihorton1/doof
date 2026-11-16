"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getManualLeftoverWindow, type AddLeftoversAction } from "@/lib/leftovers";
import { fromISODate, toISODate } from "@/lib/utils";

const addSchema = z.object({
  name: z.string().trim().min(1).max(200),
  cookedDate: z.iso.date(),
});

export const addLeftovers: AddLeftoversAction = async (input) => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) return { error: "Sign in again before adding leftovers." };

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a name (up to 200 characters) and a valid cooked date." };

  const cookedDate = fromISODate(parsed.data.cookedDate);
  const window = getManualLeftoverWindow(toISODate(new Date()));
  if (cookedDate < window.gte || cookedDate >= window.lt) {
    return { error: "Choose a cooked date from today or the previous ten days." };
  }

  try {
    await prisma.manualLeftover.create({
      data: { name: parsed.data.name, cookedDate },
    });
    revalidatePath("/today");
    return { status: "added" };
  } catch (error) {
    console.error("Failed to add leftovers", error);
    return { error: "Could not add these leftovers. Please try again." };
  }
};
