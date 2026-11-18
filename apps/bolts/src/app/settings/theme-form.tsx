"use client";

import React, { useActionState } from "react";
import { setTheme } from "./actions";
import type { Theme, ThemeState } from "../../lib/theme";

export function ThemeForm({ theme }: { theme: Theme }) {
  const [state, action, pending] = useActionState<ThemeState, FormData>(setTheme, { theme });
  return (
    <form action={action} className="idea-form">
      <fieldset className="theme-setting" disabled={pending}>
        <legend>Appearance</legend>
        <div className="theme-options">
          <button name="theme" value="light" className="button" aria-pressed={state.theme === "light"}>Light</button>
          <button name="theme" value="dark" className="button" aria-pressed={state.theme === "dark"}>Dark</button>
        </div>
      </fieldset>
      <p className="setting-description">Remembered in this browser, just for Bolts.</p>
      {state.error && <p role="alert" className="form-error">{state.error}</p>}
      <p className="save-status" role="status">{pending ? "Saving..." : state.saved ? "Appearance saved." : ""}</p>
    </form>
  );
}
