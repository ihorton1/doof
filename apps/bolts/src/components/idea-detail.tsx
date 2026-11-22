import React from "react";
import Link from "next/link";
import type { IdeaDetail as IdeaDetailData } from "../lib/ideas";
import { DeleteIdeaForm, NewEntryForm, ReactivateIdeaForm } from "./idea-forms";
import { IdeaHeader } from "./idea-header";
import { IdeaViews } from "./idea-views";
import { EntryCard } from "./entry-card";

export function IdeaDetail({ idea }: { idea: IdeaDetailData }) {
  return (
    <main className="detail-shell">
      <Link href="/" className="back-link"><span aria-hidden="true">&larr;</span> Due bolts</Link>
      <article className="detail-sheet">
        <IdeaHeader ideaId={idea.id} title={idea.title} />
        {idea.archivedAt && (
          <div className="archived-idea">
            <span className="archive-badge">Archived</span>
            <ReactivateIdeaForm ideaId={idea.id} />
          </div>
        )}
        <IdeaViews ideaId={idea.id} entries={idea.entries}>
          {idea.entries.length === 0 ? (
            <div className="empty-state">
              <h2>A place to build on this thought.</h2>
              <p>Collect notes, links and little discoveries here, one entry at a time.</p>
            </div>
          ) : (
            <ol className="entry-list" aria-label="Idea entries">
              {idea.entries.map((entry) => (
                <EntryCard key={entry.id} ideaId={idea.id} entry={entry} />
              ))}
            </ol>
          )}
          <NewEntryForm ideaId={idea.id} pendingDismissal={idea.pendingDismissal} archived={Boolean(idea.archivedAt)} />
        </IdeaViews>
        <DeleteIdeaForm ideaId={idea.id} />
      </article>
    </main>
  );
}
