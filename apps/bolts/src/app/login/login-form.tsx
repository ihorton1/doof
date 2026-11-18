"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="button button-primary" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>;
}

export function LoginForm({ next, hasError }: { next: string; hasError: boolean }) {
  return (
    <form action={login} className="idea-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={hasError}
        aria-describedby={hasError ? "login-error" : undefined}
      />
      {hasError && <p id="login-error" role="alert" className="form-error">That password wasn&apos;t right. Please try again.</p>}
      <SubmitButton />
    </form>
  );
}
