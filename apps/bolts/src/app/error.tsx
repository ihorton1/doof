"use client";

import React, { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Bolts: page could not be loaded", error);
  }, [error]);

  return (
    <main className="home-sheet error-page">
      <h1>Something didn&apos;t load.</h1>
      <p>Your ideas could not be loaded. Please try again.</p>
      <button className="button button-primary" onClick={reset}>Try again</button>
    </main>
  );
}
