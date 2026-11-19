import React from "react";
import Link from "next/link";
import { IdeaCards } from "../../components/idea-cards";
import { getIdeaPage, searchQuerySchema, type IdeaPageRequest } from "../../lib/idea-feed";
import { appPath } from "../../lib/paths";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const parsed = searchQuerySchema.safeParse(q ?? "");
  const query = parsed.success ? parsed.data : "";
  const request: IdeaPageRequest = { kind: "search", query, cursor: null };
  const page = query ? await getIdeaPage(request) : null;
  return (
    <main className="home-sheet">
      <Link href="/" className="back-link">&larr; Due bolts</Link>
      <h1>Search bolts</h1>
      <p className="search-intro">Find any bolt by its title or entry text, including snoozed and archived bolts.</p>
      <form action={appPath("/search/")} method="get" className="idea-form search-form">
        <label htmlFor="bolt-query">Title or entry text</label>
        <input id="bolt-query" type="search" name="q" defaultValue={query} maxLength={200} required placeholder="Search your bolts..." />
        <button className="button button-primary">Search</button>
      </form>
      {!parsed.success && <p role="alert" className="form-error">{parsed.error.issues[0].message}</p>}
      {page && <IdeaCards key={query} initialPage={page} request={request} />}
    </main>
  );
}
