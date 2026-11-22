"use client";

import React, { useActionState, useEffect, useId, useRef, useState } from "react";
import { updateEntry } from "../app/actions";
import type { IdeaDetail, SaveState } from "../lib/ideas";
import { parseEntryContent } from "../lib/entry-todos";
import { EntryText } from "./entry-text";
import { EntryImage, EntryImages } from "./entry-images";
import { TodoCheckbox } from "./todo-checkbox";

type Entry = IdeaDetail["entries"][number];

function EntryEditor({ ideaId, entry, onClose }: { ideaId: string; entry: Entry; onClose: () => void }) {
  const [content, setContent] = useState(`${entry.isTodo ? "[]" : ""}${entry.content}`);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const id = useId();
  const [state, action, pending] = useActionState<SaveState, FormData>(async (previous, data) => {
    const result = await updateEntry(ideaId, entry.id, previous, data);
    if (result.saved) onClose();
    return result;
  }, {});

  return (
    <form action={action} className="idea-form entry-edit-form">
      {removedImages.map((imageId) => <input key={imageId} type="hidden" name="removedImages" value={imageId} />)}
      <label htmlFor={`${id}-content`} className="visually-hidden">Edit entry</label>
      <textarea id={`${id}-content`} name="content" value={content}
        onChange={(event) => setContent(event.target.value)} rows={3} autoFocus
        required={entry.images.length === removedImages.length} maxLength={20000} disabled={pending}
        aria-invalid={Boolean(state.error)} aria-describedby={state.error ? `${id}-error` : undefined} />
      {entry.images.length > removedImages.length && (
        <ul className="entry-edit-images" aria-label="Attached images">
          {entry.images.map((image, index) => !removedImages.includes(image.id) && (
            <li key={image.id}>
              <EntryImage id={image.id} index={index} />
              <button type="button" className="entry-image-remove" aria-label={`Remove image ${index + 1}`} disabled={pending}
                onClick={() => setRemovedImages((current) => [...current, image.id])}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.error && <p id={`${id}-error`} role="alert" className="form-error">{state.error}</p>}
      <div className="form-footer entry-actions">
        {parseEntryContent(content).isTodo && <span className="todo-draft" role="status">To-do</span>}
        <button type="button" className="button button-secondary" disabled={pending} onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save entry"}</button>
      </div>
    </form>
  );
}

export function EntryCard({ ideaId, entry }: { ideaId: string; entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (wasEditing.current && !editing) buttonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  return (
    <li className={`entry-card${!editing && entry.isTodo ? " todo-entry" : ""}${entry.completedAt ? " todo-completed" : ""}`}>
      <div className={`entry-heading${!editing && entry.isTodo ? " todo-entry-heading" : ""}`}>
        <time dateTime={entry.createdAt.toISOString()}>{entry.createdAt.toISOString().slice(0, 10)}</time>
      </div>
      {editing ? (
        <EntryEditor ideaId={ideaId} entry={entry} onClose={() => setEditing(false)} />
      ) : (
        <>
          <button type="button" className="entry-edit-button" aria-label="Edit entry" ref={buttonRef} onClick={() => setEditing(true)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" />
            </svg>
          </button>
          {entry.isTodo && <TodoCheckbox ideaId={ideaId} entry={entry} />}
          {entry.content && <p><EntryText text={entry.content} /></p>}
        </>
      )}
      {!editing && <EntryImages images={entry.images} />}
    </li>
  );
}
