"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ingredientSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

const dishSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  notes: z.string().max(20000).optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
  imageUrl: z.string().max(5_000_000).optional().nullable(),
  ingredients: z.array(ingredientSchema),
});

function parseDishForm(formData: FormData) {
  const names = formData.getAll("ingredient_name").map(String);
  const quantities = formData.getAll("ingredient_quantity").map(String);
  const units = formData.getAll("ingredient_unit").map(String);

  const ingredients = names
    .map((name, i) => ({
      name: name.trim(),
      quantity: (quantities[i] ?? "").trim() || null,
      unit: (units[i] ?? "").trim() || null,
      notes: null,
    }))
    .filter((ing) => ing.name.length > 0);

  const servingsRaw = formData.get("servings");
  const servings =
    servingsRaw && String(servingsRaw).trim() !== ""
      ? Number(servingsRaw)
      : null;

  const sourceUrlRaw = String(formData.get("sourceUrl") ?? "").trim();
  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();

  return dishSchema.parse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    servings,
    sourceUrl: sourceUrlRaw || null,
    imageUrl: imageUrlRaw || null,
    ingredients,
  });
}

export async function createDish(formData: FormData) {
  const data = parseDishForm(formData);
  const dish = await prisma.dish.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      notes: data.notes ?? null,
      servings: data.servings ?? null,
      sourceUrl: data.sourceUrl || null,
      imageUrl: data.imageUrl || null,
      ingredients: {
        create: data.ingredients.map((ing, i) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          notes: ing.notes ?? null,
          position: i,
        })),
      },
    },
  });
  revalidatePath("/dishes");
  redirect(`/dishes/${dish.id}`);
}

export async function updateDish(id: string, formData: FormData) {
  const data = parseDishForm(formData);
  await prisma.$transaction([
    prisma.dishIngredient.deleteMany({ where: { dishId: id } }),
    prisma.dish.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        notes: data.notes ?? null,
        servings: data.servings ?? null,
        sourceUrl: data.sourceUrl || null,
        imageUrl: data.imageUrl || null,
        ingredients: {
          create: data.ingredients.map((ing, i) => ({
            name: ing.name,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
            notes: ing.notes ?? null,
            position: i,
          })),
        },
      },
    }),
  ]);
  revalidatePath("/dishes");
  revalidatePath(`/dishes/${id}`);
  redirect(`/dishes/${id}`);
}

export async function deleteDish(id: string) {
  await prisma.dish.delete({ where: { id } });
  revalidatePath("/dishes");
  redirect("/dishes");
}
