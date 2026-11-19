import React from "react";
import Link from "next/link";
import type { IdeaPage, IdeaPageRequest } from "../lib/idea-feed";
import { IdeaCards } from "./idea-cards";
import { UserMenu } from "./user-menu";

export function IdeaList({ page, request }: { page: IdeaPage; request: IdeaPageRequest }) {
  return (
    <main className="home-sheet due-feed">
      <header className="home-header">
        <p className="wordmark"><span aria-hidden="true">&#9889;</span>{" "}bolts<span aria-hidden="true">.</span></p>
        <UserMenu />
        <h1>Your bolts</h1>
        <Link href="/ideas/new" className="button button-primary">+ New idea</Link>
      </header>
      <IdeaCards initialPage={page} request={request} />
      <nav className="feed-navigation" aria-label="Bolts navigation">
        <Link href="/search" className="button button-primary feed-search">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          Search bolts
        </Link>
      </nav>
    </main>
  );
}
