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

export function extractEntryLinks(text: string) {
  const links: { index: number; label: string; href: string }[] = [];
  for (const match of text.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"'\u2018\u2019\u201c\u201d]+/gi)) {
    const label = trimUrlEnd(match[0]);
    const href = /^www\./i.test(label) ? `https://${label}` : label;
    if (URL.canParse(href)) links.push({ index: match.index, label, href });
  }
  return links;
}
