"use client";

import React, { useId, useRef, useState, type ReactNode } from "react";
import type { IdeaDetail } from "../lib/ideas";
import { extractEntryLinks } from "../lib/entry-links";
import { EntryCard } from "./entry-card";

export function IdeaLinks({ entries }: { entries: IdeaDetail["entries"] }) {
  const links = entries.flatMap((entry) => extractEntryLinks(entry.content).map((link) => ({
    ...link, entryId: entry.id, createdAt: entry.createdAt,
  })));

  if (links.length === 0) {
    return (
      <div className="empty-state">
        <h2>No links yet.</h2>
        <p>Links from your saved entries will appear here.</p>
      </div>
    );
  }

  return (
    <ul className="bolt-link-list" aria-label="Links from all entries">
      {links.map((link) => (
        <li key={`${link.entryId}-${link.index}`} className="bolt-link-card">
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            <span className="bolt-link-host">{new URL(link.href).hostname}</span>
            <span className="bolt-link-url">{link.label}</span>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6m0-6L10 14M10 3H3v18h18v-7" />
            </svg>
          </a>
          <time dateTime={link.createdAt.toISOString()}>{link.createdAt.toISOString().slice(0, 10)}</time>
        </li>
      ))}
    </ul>
  );
}

export function IdeaTodos({ ideaId, entries }: { ideaId: string; entries: IdeaDetail["entries"] }) {
  const todos = entries.filter((entry) => entry.isTodo);
  if (todos.length === 0) {
    return (
      <div className="empty-state">
        <h2>No to-dos yet.</h2>
        <p>Start an entry with [] to add a to-do.</p>
      </div>
    );
  }
  return (
    <ol className="entry-list" aria-label="To-dos">
      {todos.map((entry) => <EntryCard key={entry.id} ideaId={ideaId} entry={entry} />)}
    </ol>
  );
}

export function IdeaViews({ ideaId, entries, children }: { ideaId: string; entries: IdeaDetail["entries"]; children?: ReactNode }) {
  const [selected, setSelected] = useState(0);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const labels = ["Entries", "To-dos", "Links"];

  return (
    <>
      <div className="bolt-tabs" role="tablist" aria-label="Bolt views">
        {labels.map((label, index) => (
          <button key={label} type="button" role="tab" id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`} aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1} ref={(element) => { tabsRef.current[index] = element; }}
            onClick={() => setSelected(index)} onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight") next = (index + 1) % labels.length;
              else if (event.key === "ArrowLeft") next = (index + labels.length - 1) % labels.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = labels.length - 1;
              else return;
              event.preventDefault();
              setSelected(next);
              tabsRef.current[next]?.focus();
            }}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={selected !== 0} tabIndex={0}>
        {children}
      </div>
      <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={selected !== 1} tabIndex={0}>
        <IdeaTodos ideaId={ideaId} entries={entries} />
      </div>
      <div role="tabpanel" id={`${id}-panel-2`} aria-labelledby={`${id}-tab-2`} hidden={selected !== 2} tabIndex={0}>
        <IdeaLinks entries={entries} />
      </div>
    </>
  );
}
