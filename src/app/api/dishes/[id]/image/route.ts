import { prisma } from "@/lib/prisma";
import { dishImageResponse } from "@/lib/dish-image-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dish = await prisma.dish.findUnique({
    where: { id },
    select: { imageUrl: true },
  });

  return dishImageResponse(dish?.imageUrl);
}
