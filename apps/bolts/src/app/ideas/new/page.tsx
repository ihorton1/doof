import React from "react";
import Link from "next/link";
import { NewIdeaForm } from "../../../components/idea-forms";

export default function NewIdeaPage() {
  return (
    <main className="detail-shell">
      <Link href="/" className="back-link"><span aria-hidden="true">&larr;</span> All ideas</Link>
      <article className="detail-sheet">
        <header className="detail-header">
          <p className="wordmark"><span aria-hidden="true">&#9889;</span>{" "}bolts<span aria-hidden="true">.</span></p>
          <h1 className="visually-hidden">New idea</h1>
        </header>
        <NewIdeaForm />
      </article>
    </main>
  );
}
