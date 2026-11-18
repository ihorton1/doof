import React from "react";
import Link from "next/link";
import type { IdeaDetail as IdeaDetailData } from "../lib/ideas";
import { NewEntryForm } from "./idea-forms";
import { EntryText } from "./entry-text";

export function IdeaDetail({ idea }: { idea: IdeaDetailData }) {
  return (
    <main className="detail-shell">
      <Link href="/" className="back-link"><span aria-hidden="true">&larr;</span> All ideas</Link>
      <article className="detail-sheet">
        <header className="detail-header">
          <p className="wordmark">bolts<span aria-hidden="true">.</span></p>
          <h1>{idea.title}</h1>
        </header>
        {idea.entries.length === 0 ? (
          <div className="empty-state">
            <h2>A place to build on this thought.</h2>
            <p>Collect notes, links and little discoveries here, one entry at a time.</p>
          </div>
        ) : (
          <ol className="entry-list" aria-label="Idea entries">
            {idea.entries.map((entry) => (
              <li key={entry.id} className="entry-card">
                <time dateTime={entry.createdAt.toISOString()}>
                  {entry.createdAt.toISOString().slice(0, 10)}
                </time>
                <p><EntryText text={entry.content} /></p>
              </li>
            ))}
          </ol>
        )}
        <NewEntryForm ideaId={idea.id} />
      </article>
    </main>
  );
}
