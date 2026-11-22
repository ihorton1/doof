import React, { type ReactNode } from "react";
import { extractEntryLinks } from "../lib/entry-links";

export function EntryText({ text }: { text: string }) {
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
