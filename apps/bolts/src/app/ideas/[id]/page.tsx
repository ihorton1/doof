import React from "react";
import { notFound } from "next/navigation";
import { IdeaDetail } from "../../../components/idea-detail";
import { getPrisma } from "../../../lib/prisma";
import { activeIdeaWhere } from "../../../lib/ideas";

export const dynamic = "force-dynamic";

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = await getPrisma().idea.findUnique({
    where: { id, ...activeIdeaWhere },
    include: { entries: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { images: { orderBy: { position: "asc" }, select: { id: true } } },
    } },
  });
  if (!idea) notFound();
  return <IdeaDetail idea={idea} />;
}
