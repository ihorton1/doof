import React, { type ReactNode } from "react";
import { IdeaList } from "../../components/idea-list";
import { getIdeaPage, type IdeaPageRequest } from "../../lib/idea-feed";

export const dynamic = "force-dynamic";

export default async function IdeasLayout({ children }: { children: ReactNode }) {
  const request: IdeaPageRequest = { kind: "due", asOf: new Date().toISOString(), cursor: null };
  const page = await getIdeaPage(request);
  return (
    <div className="swipe-stage">
      <div className="swipe-home-preview" aria-hidden="true" inert>
        <IdeaList page={page} request={request} preview />
      </div>
      {children}
    </div>
  );
}
