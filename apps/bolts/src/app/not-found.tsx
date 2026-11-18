import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="home-sheet error-page">
      <h1>Idea not found.</h1>
      <p>This idea may have been removed, or the link might be incomplete.</p>
      <Link className="back-link" href="/">Back to your ideas &rarr;</Link>
    </main>
  );
}
