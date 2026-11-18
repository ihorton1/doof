"use client";

import React, { useActionState, useRef, useState } from "react";
import { addEntry, createIdea, deleteIdea } from "../app/actions";
import type { SaveState } from "../lib/ideas";

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

export function NewEntryForm({ ideaId }: { ideaId: string }) {
  const [content, setContent] = useState("");
  const [state, action, pending] = useActionState<SaveState, FormData>(
    async (previous, formData) => {
      const result = await addEntry(ideaId, previous, formData);
      if (result.saved) setContent("");
      return result;
    },
    {},
  );

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
        disabled={pending}
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "entry-error" : undefined}
      />
      {state.error && <p id="entry-error" role="alert" className="form-error">{state.error}</p>}
      <div className="form-footer">
        <p className="save-status" role="status">{state.saved && !content ? "Entry saved." : ""}</p>
        <button className="button button-primary" disabled={pending}>
          {pending ? "Saving..." : "Add entry"}
        </button>
      </div>
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
