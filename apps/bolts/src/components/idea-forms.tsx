"use client";

import React, { useActionState, useRef, useState } from "react";
import { addEntry, archiveIdea, createIdea, deleteIdea, dismissIdea, reactivateIdea, snoozeIdea } from "../app/actions";
import type { IdeaSummary, SaveState } from "../lib/ideas";
import { snoozeDays } from "../lib/idea-schedule";

export function NewIdeaForm() {
  const [title, setTitle] = useState("");
  const [state, action, pending] = useActionState<SaveState, FormData>(createIdea, {});

  return (
    <form action={action} className="idea-form">
      <label htmlFor="idea-title" className="visually-hidden">Idea title</label>
      <input
        id="idea-title"
        className="idea-title-input"
        name="title"
        placeholder="title..."
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        maxLength={200}
        disabled={pending}
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "idea-error" : undefined}
      />
      {state.error && <p id="idea-error" role="alert" className="form-error">{state.error}</p>}
      <button className="button button-primary" disabled={pending}>
        {pending ? "Saving..." : "Save idea"}
      </button>
    </form>
  );
}

export function NewEntryForm({ ideaId, pendingDismissal, archived }: { ideaId: string; pendingDismissal: boolean; archived: boolean }) {
  const [content, setContent] = useState("");
  const [state, action, pending] = useActionState<SaveState, FormData>(
    async (previous, formData) => {
      const result = await addEntry(ideaId, previous, formData);
      if (result.saved) setContent("");
      return result;
    },
    {},
  );
  const [dismissState, dismissAction, dismissPending] = useActionState<SaveState, FormData>(dismissIdea.bind(null, ideaId), {});
  const busy = pending || dismissPending;

  return (
    <form action={action} className="idea-form entry-form">
      <label htmlFor="entry-content">Add to this idea</label>
      <textarea
        id="entry-content"
        name="content"
        placeholder="A note, a link, something you learned..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={3}
        required
        maxLength={20000}
        disabled={busy}
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "entry-error" : undefined}
      />
      {state.error && <p id="entry-error" role="alert" className="form-error">{state.error}</p>}
      {dismissState.error && <p role="alert" className="form-error">{dismissState.error}</p>}
      <div className="form-footer entry-actions">
        {pendingDismissal && !archived && !content && (
          <button type="submit" formAction={dismissAction} formNoValidate className="button button-secondary done-for-now" disabled={busy}>
            {dismissPending ? "Saving..." : "Done for now"}
          </button>
        )}
        <button type="submit" className="button button-primary" disabled={busy}>
          {pending ? "Saving..." : "Add entry"}
        </button>
      </div>
    </form>
  );
}

export function SnoozeIdeaForm({ idea, onSnoozed }: { idea: IdeaSummary; onSnoozed: () => void }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(async () => {
    const result = await snoozeIdea(idea.id, idea.dueAt.toISOString());
    if (result.saved) onSnoozed();
    return result;
  }, {});
  const days = snoozeDays(idea.snoozeCount);
  return (
    <form action={action} className="swipe-action-form snooze-form">
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      <button className="button button-secondary" disabled={pending} aria-label={`Snooze ${idea.title} for ${days} ${days === 1 ? "day" : "days"}`}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
        </svg>
        <span>{pending ? "Snoozing..." : "Snooze"}</span>
        <span className="swipe-action-detail">{days} {days === 1 ? "day" : "days"}</span>
      </button>
    </form>
  );
}

export function ArchiveIdeaForm({ idea, onArchived }: { idea: IdeaSummary; onArchived: () => void }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(async () => {
    const result = await archiveIdea(idea.id);
    if (result.saved) onArchived();
    return result;
  }, {});
  return (
    <form action={action} className="swipe-action-form archive-form">
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      <button className="button button-archive" disabled={pending} aria-label={`Archive ${idea.title}`}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 8v12h16V8M3 3h18v5H3zM9 12h6" />
        </svg>
        <span>{pending ? "Archiving..." : "Archive"}</span>
      </button>
    </form>
  );
}

export function ReactivateIdeaForm({ ideaId }: { ideaId: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(reactivateIdea.bind(null, ideaId), {});
  return (
    <form action={action} className="idea-form">
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      <button className="button button-secondary" disabled={pending}>{pending ? "Reactivating..." : "Reactivate"}</button>
    </form>
  );
}

export function DeleteIdeaForm({ ideaId }: { ideaId: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [state, action, pending] = useActionState<SaveState, FormData>(deleteIdea.bind(null, ideaId), {});

  function cancel() {
    const details = detailsRef.current;
    if (details) {
      details.open = false;
      details.querySelector("summary")?.focus();
    }
  }

  return (
    <details className="delete-idea" ref={detailsRef}>
      <summary>Delete idea</summary>
      <form action={action} className="idea-form">
        <p className="delete-confirmation">Are you sure?</p>
        {state.error && <p role="alert" className="form-error">{state.error}</p>}
        <div className="form-footer">
          <button type="button" className="button button-secondary" disabled={pending} onClick={cancel}>Cancel</button>
          <button type="submit" className="button button-danger" disabled={pending}>
            {pending ? "Deleting..." : "Delete idea"}
          </button>
        </div>
      </form>
    </details>
  );
}
