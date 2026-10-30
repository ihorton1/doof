import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { mealDateSchema } from "@/lib/meal-days";
import { readMealDays } from "@/lib/meal-days-data";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!isValidSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Sign in again to load meals." }, { status: 401, headers });
  }
  const parsed = mealDateSchema.safeParse(request.nextUrl.searchParams.get("start"));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid start date." }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await readMealDays(parsed.data), { headers });
  } catch (error) {
    console.error("Failed to load meal days", error);
    return NextResponse.json({ error: "Could not load more days." }, { status: 500, headers });
  }
}
