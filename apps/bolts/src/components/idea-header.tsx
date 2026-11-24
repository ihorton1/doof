"use client";

import React, { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { updateIdeaTitle } from "../app/actions";
import { ideaTitleSchema, type SaveState } from "../lib/ideas";
import { useMenuDismiss } from "./use-menu-dismiss";

export function IdeaHeader({ ideaId, title = "", onTitleChange, children }: {
  ideaId?: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const menuRef = useRef<HTMLDetailsElement>(null);
  useMenuDismiss(menuRef);
  const [state, action, pending] = useActionState<SaveState, FormData>(async (previous, data) => {
    const input = ideaTitleSchema.safeParse(data.get("title"));
    if (!input.success) return { error: input.error.issues[0].message };
    const result = ideaId ? await updateIdeaTitle(ideaId, previous, data) : { saved: true };
    if (result.saved) {
      onTitleChange?.(input.data);
      setEditing(false);
    }
    return result;
  }, {});

  return (
    <header className="detail-header">
      <Link href="/" className="back-link"><span aria-hidden="true">&larr;</span> Due bolts</Link>
      <p className="wordmark"><span aria-hidden="true">&#9889;</span>{" "}bolts<span aria-hidden="true">.</span></p>
      <details className="user-menu bolt-menu" ref={menuRef}>
        <summary aria-label="Bolt options">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </summary>
        <div className="user-menu-panel">
          <button type="button" className="user-menu-item" onClick={() => {
            setDraft(title);
            setEditing(true);
            if (menuRef.current) menuRef.current.open = false;
          }}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" />
            </svg>
            <span>{title ? "Edit title" : "Add title"}</span>
          </button>
          {children}
        </div>
      </details>
      {editing ? (
        <form action={action} className="idea-form title-form" data-swipe-home-blocked="true">
          <label htmlFor="idea-title" className="visually-hidden">Idea title</label>
          <input id="idea-title" name="title" className="idea-title-input" placeholder="title..."
            value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={200}
            autoFocus disabled={pending} aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "title-error" : undefined} />
          {state.error && <p id="title-error" role="alert" className="form-error">{state.error}</p>}
          <div className="form-footer">
            <button type="button" className="button button-secondary" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
            <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save title"}</button>
          </div>
        </form>
      ) : title ? <h1>{title}</h1> : <h1 className="visually-hidden">{ideaId ? "Untitled bolt" : "New bolt"}</h1>}
    </header>
  );
}
