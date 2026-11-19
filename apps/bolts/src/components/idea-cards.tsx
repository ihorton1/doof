"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadIdeaPage } from "../app/actions";
import type { IdeaPage, IdeaPageRequest } from "../lib/idea-feed";
import { EntryText } from "./entry-text";
import { SwipeIdeaCard } from "./swipe-idea-card";
import { EntryImages } from "./entry-images";

export function IdeaCards({ initialPage, request }: { initialPage: IdeaPage; request: IdeaPageRequest }) {
  const [page, setPage] = useState(initialPage);
  const [snapshot] = useState(request);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !page.nextCursor) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await loadIdeaPage({ ...snapshot, cursor: page.nextCursor });
      if (result.error !== undefined) {
        setError(result.error);
      } else {
        setPage((current) => {
          const ids = new Set(current.ideas.map((idea) => idea.id));
          return {
            ideas: [...current.ideas, ...result.page.ideas.filter((idea) => !ids.has(idea.id))],
            nextCursor: result.page.nextCursor,
          };
        });
      }
    } catch (failure) {
      console.error("Bolts: could not load more ideas", failure);
      setError("More bolts could not be loaded. Please try again.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [page.nextCursor, snapshot]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !page.nextCursor || error || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "200px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [page.nextCursor, error, loadMore]);

  return (
    <>
      {page.ideas.length === 0 && !page.nextCursor && (
        <div className="empty-state">
          <h2>{request.kind === "due" ? "Nothing due right now." : "No matching bolts."}</h2>
          <p>{request.kind === "due"
            ? "Add a new idea, search your bolts, or come back when another thought is ready to revisit."
            : "Try another title or a phrase from an entry. Snoozed and archived bolts are included."}</p>
        </div>
      )}
      <ul className="idea-list" aria-label={request.kind === "due" ? "Your bolts" : "Search results"} aria-busy={loading}>
        {page.ideas.map((idea) => {
          const latestEntry = idea.entries[0];
          const content = (
            <>
              <Link className="idea-card-title" href={`/ideas/${idea.id}`}>{idea.title}</Link>
              {latestEntry && (
                <div className="idea-card-preview">
                  <time dateTime={latestEntry.createdAt.toISOString()}>
                    {latestEntry.createdAt.toISOString().slice(0, 10)}
                  </time>
                  {latestEntry.content && <p><EntryText text={latestEntry.content} /></p>}
                  <EntryImages images={latestEntry.images} compact />
                </div>
              )}
              <span className="idea-card-meta">
                <span>{idea._count.entries} {idea._count.entries === 1 ? "entry" : "entries"}</span>
                {idea.archivedAt && <span className="archive-badge">Archived</span>}
              </span>
            </>
          );
          return (
            <li key={idea.id}>
              {request.kind === "due" ? (
                <SwipeIdeaCard idea={idea} onRemoved={(action) => {
                    setPage((current) => ({ ...current, ideas: current.ideas.filter((item) => item.id !== idea.id) }));
                    setNotice(`"${idea.title}" ${action}.`);
                }}>
                  {content}
                </SwipeIdeaCard>
              ) : <article className="idea-card">{content}</article>}
            </li>
          );
        })}
      </ul>
      <p className="save-status feed-status" role="status">{notice}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {page.nextCursor && (
        <div className="feed-pagination" ref={sentinelRef}>
          <button type="button" className="button button-secondary" disabled={loading} onClick={() => void loadMore()}>
            {loading ? "Loading..." : error ? "Try loading more" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
