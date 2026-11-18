"use client";

import React, { useActionState, useState } from "react";
import { addEntry, createIdea } from "../app/actions";
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
