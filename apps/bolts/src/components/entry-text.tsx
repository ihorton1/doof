import React, { type ReactNode } from "react";

function trimUrlEnd(candidate: string) {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let text = candidate;
  while (text) {
    text = text.replace(/[.,!?;:]+$/, "");
    const closing = text.at(-1) ?? "";
    const opening = pairs[closing];
    if (!opening || text.split(closing).length <= text.split(opening).length) break;
    text = text.slice(0, -1);
  }
  return text;
}

export function EntryText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"'\u2018\u2019\u201c\u201d]+/gi)) {
    const label = trimUrlEnd(match[0]);
    const href = /^www\./i.test(label) ? `https://${label}` : label;
    if (!URL.canParse(href)) continue;

    parts.push(text.slice(cursor, match.index));
    parts.push(
      <a key={match.index} href={href} className="entry-link" target="_blank" rel="noopener noreferrer">
        {label}
      </a>,
    );
    cursor = match.index + label.length;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
