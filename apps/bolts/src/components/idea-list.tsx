import React from "react";
import Link from "next/link";
import type { IdeaSummary } from "../lib/ideas";
import { EntryText } from "./entry-text";
import { UserMenu } from "./user-menu";

export function IdeaList({ ideas }: { ideas: IdeaSummary[] }) {
  return (
    <main className="home-sheet">
      <header className="home-header">
        <p className="wordmark"><span aria-hidden="true">&#9889;</span>{" "}bolts<span aria-hidden="true">.</span></p>
        <UserMenu />
        <h1>Your bolts</h1>
        <Link href="/ideas/new" className="button button-primary">+ New idea</Link>
      </header>
      {ideas.length === 0 ? (
        <div className="empty-state">
          <h2>Every idea starts somewhere.</h2>
          <p>Add your first idea, then come back whenever you find something worth keeping.</p>
        </div>
      ) : (
        <ul className="idea-list" aria-label="Your bolts">
          {ideas.map((idea) => {
            const latestEntry = idea.entries[0];
            return (
              <li key={idea.id}>
                <article className="idea-card">
                  <Link className="idea-card-title" href={`/ideas/${idea.id}`}>{idea.title}</Link>
                  {latestEntry && (
                    <div className="idea-card-preview">
                      <time dateTime={latestEntry.createdAt.toISOString()}>
                        {latestEntry.createdAt.toISOString().slice(0, 10)}
                      </time>
                      <p><EntryText text={latestEntry.content} /></p>
                    </div>
                  )}
                  <span className="idea-card-meta">
                    {idea._count.entries} {idea._count.entries === 1 ? "entry" : "entries"}
                    <span className="card-arrow" aria-hidden="true">&rarr;</span>
                  </span>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
