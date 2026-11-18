import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidSessionCookie, SESSION_COOKIE_NAME } from "../../lib/auth";
import { safeNextPath } from "../../lib/paths";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeNextPath(next);
  if (isValidSessionCookie((await cookies()).get(SESSION_COOKIE_NAME)?.value)) redirect(destination);
  return (
    <main className="detail-shell">
      <article className="detail-sheet login-sheet">
        <header className="detail-header">
          <p className="wordmark"><span aria-hidden="true">&#9889;</span>{" "}bolts<span aria-hidden="true">.</span></p>
          <h1>Your ideas, kept here.</h1>
          <p className="login-intro">Sign in to your bolts.</p>
        </header>
        <LoginForm next={destination} hasError={Boolean(error)} />
      </article>
    </main>
  );
}
