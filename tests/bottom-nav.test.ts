import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { BottomNav } from "../src/components/bottom-nav";

function renderNav(pathname: string) {
  return renderToStaticMarkup(
    createElement(PathnameContext.Provider, { value: pathname }, createElement(BottomNav)),
  );
}

test("bottom navigation exposes Today, Meals, Plan, Dishes and Shop in order", () => {
  const html = renderNav("/today");
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span><\/a>/g)];
  assert.deepEqual(links.map(([, href, label]) => ({ href, label })), [
    { href: "/today", label: "Today" },
    { href: "/meals", label: "Meals" },
    { href: "/plan", label: "Plan" },
    { href: "/dishes", label: "Dishes" },
    { href: "/shop", label: "Shop" },
  ]);
  assert.match(html, /grid-cols-5/);
  assert.match(html, /lucide-calendar-days/);
  assert.match(html, /lucide-book-open/);
});

test("bottom navigation marks only the current tab, including nested routes", () => {
  for (const [pathname, expectedHref] of [
    ["/today", "/today"],
    ["/meals", "/meals"],
    ["/plan", "/plan"],
    ["/dishes/recipe-1", "/dishes"],
    ["/shop", "/shop"],
  ]) {
    const html = renderNav(pathname);
    const currentLinks = [...html.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)];
    assert.equal(currentLinks.length, 1, pathname);
    assert.ok(currentLinks[0][0].includes(`href="${expectedHref}"`), pathname);
  }
  assert.doesNotMatch(renderNav("/meals-other"), /aria-current="page"/);
});
