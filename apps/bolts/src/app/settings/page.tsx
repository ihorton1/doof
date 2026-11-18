import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { THEME_COOKIE_NAME, getTheme } from "../../lib/theme";
import { ThemeForm } from "./theme-form";

export default async function SettingsPage() {
  const theme = getTheme((await cookies()).get(THEME_COOKIE_NAME)?.value);
  return (
    <main className="detail-shell">
      <Link href="/" className="back-link"><span aria-hidden="true">&larr;</span> All ideas</Link>
      <article className="detail-sheet">
        <header className="detail-header">
          <p className="wordmark"><span aria-hidden="true">&#9889;</span>{" "}bolts<span aria-hidden="true">.</span></p>
          <h1>Settings</h1>
        </header>
        <ThemeForm theme={theme} />
      </article>
    </main>
  );
}
