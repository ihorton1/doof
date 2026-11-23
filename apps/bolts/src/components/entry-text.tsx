"use client";

import React, { useRef, type ReactNode } from "react";
import Link from "next/link";
import { extractEntryLinks } from "../lib/entry-links";

export function EntryText({ text, linkedIdeaId }: { text: string; linkedIdeaId?: string | null }) {
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  if (linkedIdeaId) {
    return (
      <Link href={`/ideas/${linkedIdeaId}`} className="entry-link entry-bolt-link" title="Double-tap to open bolt"
        onClick={(event) => {
          if (event.detail === 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          const previous = lastTap.current;
          lastTap.current = { time: event.timeStamp, x: event.clientX, y: event.clientY };
          if (event.detail >= 2 || (previous && event.timeStamp - previous.time <= 350
            && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 20)) {
            lastTap.current = null;
            return;
          }
          event.preventDefault();
        }}>
        <span aria-hidden="true">&#9889;</span>{" "}{text || "Untitled bolt"}
      </Link>
    );
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const { index, label, href } of extractEntryLinks(text)) {
    parts.push(text.slice(cursor, index));
    parts.push(
      <a key={index} href={href} className="entry-link" target="_blank" rel="noopener noreferrer">
        {label}
      </a>,
    );
    cursor = index + label.length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
