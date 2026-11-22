"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ideaLabel, type IdeaSummary } from "../lib/ideas";
import { ArchiveIdeaForm, SnoozeIdeaForm } from "./idea-forms";

export function SwipeIdeaCard({ idea, onRemoved, children }: {
  idea: IdeaSummary;
  onRemoved: (action: "snoozed" | "archived") => void;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const actionsId = `bolt-actions-${idea.id}`;

  const reveal = useCallback((open: boolean) => {
    const element = scroller.current;
    if (element) element.scrollTo({ left: open ? element.scrollWidth - element.clientWidth : 0 });
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !scroller.current?.contains(event.target)) reveal(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [expanded, reveal]);

  return (
    <div
      className="swipe-card"
      ref={scroller}
      onScroll={(event) => setExpanded(event.currentTarget.scrollLeft > 4)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.preventDefault();
          reveal(false);
          toggle.current?.focus({ preventScroll: true });
        }
      }}
    >
      <article className="idea-card">
        {children}
        <button
          type="button"
          className="card-actions-toggle"
          ref={toggle}
          aria-label={`Actions for ${ideaLabel(idea.title)}`}
          aria-controls={actionsId}
          aria-expanded={expanded}
          onClick={() => reveal(!expanded)}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </article>
      <div id={actionsId} className="swipe-actions" role="group" aria-label={`Actions for ${ideaLabel(idea.title)}`} onFocusCapture={() => reveal(true)}>
        <SnoozeIdeaForm idea={idea} onSnoozed={() => onRemoved("snoozed")} />
        <ArchiveIdeaForm idea={idea} onArchived={() => onRemoved("archived")} />
      </div>
    </div>
  );
}
