"use client";

import React, { useActionState, useTransition } from "react";
import { setEntryCompleted } from "../app/actions";
import type { IdeaDetail, SaveState } from "../lib/ideas";

export function TodoCheckbox({ ideaId, entry }: { ideaId: string; entry: IdeaDetail["entries"][number] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    setEntryCompleted.bind(null, ideaId, entry.id), {},
  );
  const completed = Boolean(entry.completedAt);
  const description = entry.content.replace(/\s+/g, " ").slice(0, 120) || "Image entry";
  const [, startTransition] = useTransition();

  return (
    <>
      <span className="todo-toggle">
        <input type="checkbox" checked={completed} disabled={pending}
          aria-label={`${completed ? "Reopen" : "Complete"} to-do: ${description}`}
          onChange={(event) => {
            const data = new FormData();
            data.set("completed", String(event.currentTarget.checked));
            startTransition(() => action(data));
          }} />
      </span>
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
    </>
  );
}
