import React from "react";
import Link from "next/link";
import { NewIdeaForm } from "../../../components/idea-forms";

export default function NewIdeaPage() {
  return (
    <main className="detail-shell">
      <Link href="/" className="back-link"><span aria-hidden="true">&larr;</span> Due bolts</Link>
      <article className="detail-sheet">
        <NewIdeaForm />
      </article>
    </main>
  );
}
