import React from "react";
import { IdeaList } from "../components/idea-list";
import { getIdeaPage, type IdeaPageRequest } from "../lib/idea-feed";

export const dynamic = "force-dynamic";

export default async function Home() {
  const request: IdeaPageRequest = { kind: "due", asOf: new Date().toISOString(), cursor: null };
  const page = await getIdeaPage(request);
  return <IdeaList page={page} request={request} />;
}
