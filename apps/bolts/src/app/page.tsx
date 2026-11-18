import React from "react";
import { IdeaList } from "../components/idea-list";
import { getPrisma } from "../lib/prisma";
import { activeIdeaWhere, ideaFeedSelect } from "../lib/ideas";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ideas = await getPrisma().idea.findMany({
    where: activeIdeaWhere,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: ideaFeedSelect,
  });
  return <IdeaList ideas={ideas} />;
}
