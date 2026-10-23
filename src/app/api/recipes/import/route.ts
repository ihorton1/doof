import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { fetchRecipePage } from "@/lib/recipe-fetch";
import { extractRecipes, RecipeImportError } from "@/lib/recipe-import";

export const runtime = "nodejs";

const inputSchema = z.object({ url: z.string().trim().min(1).max(500) });

export async function POST(request: NextRequest) {
  if (!isValidSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Sign in before importing a recipe." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  }
  const input = inputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Enter a recipe URL of 500 characters or fewer." }, { status: 400 });
  }

  try {
    const page = await fetchRecipePage(input.data.url);
    return NextResponse.json(extractRecipes(page.html, page.url), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof RecipeImportError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Recipe ingredient import failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Could not import ingredients. Please try again." }, { status: 500 });
  }
}
