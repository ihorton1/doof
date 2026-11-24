"use client";

import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type SwipeStart = { id: number; x: number; y: number };

export function isHomeSwipe(start: SwipeStart, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  return dx >= 80 && dx >= dy * 2;
}

function isBlocked(root: HTMLElement) {
  return Boolean(root.querySelector('[data-swipe-home-blocked="true"], details[open]'))
    || window.getSelection()?.isCollapsed === false;
}

export function BoltShell({ children }: { children: ReactNode }) {
  const start = useRef<SwipeStart | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "settling" | "leaving">("idle");
  const swipeStyle: CSSProperties & { "--swipe-offset": string } = { "--swipe-offset": `${offset}px` };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function reset() {
    start.current = null;
    setOffset(0);
    setPhase("settling");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("idle"), 200);
  }

  return (
    <main className="detail-shell swipe-home" data-swipe-phase={phase}
      style={swipeStyle}
      onTouchStart={(event) => {
        start.current = null;
        if (phase === "leaving") return;
        if (timer.current) clearTimeout(timer.current);
        setOffset(0);
        setPhase("idle");
        if (event.touches.length !== 1 || isBlocked(event.currentTarget)) return;
        if (event.target instanceof Element && event.target.closest("a, button, input, textarea, select, summary, form, [contenteditable]:not([contenteditable=false])")) return;
        const touch = event.touches[0];
        start.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
      }}
      onTouchMove={(event) => {
        const initial = start.current;
        if (!initial) return;
        const touch = event.touches[0];
        if (event.touches.length !== 1 || touch.identifier !== initial.id || isBlocked(event.currentTarget)) {
          reset();
          return;
        }
        const dx = touch.clientX - initial.x;
        const dy = Math.abs(touch.clientY - initial.y);
        if (dx < -10 || (dy > 10 && dy > Math.abs(dx))) {
          reset();
        } else if (dx > 10) {
          setPhase("dragging");
          setOffset(Math.min(dx, window.innerWidth));
        }
      }}
      onTouchCancel={reset}
      onTouchEnd={(event) => {
        const initial = start.current;
        start.current = null;
        if (phase === "leaving") return;
        if (!initial || event.touches.length > 0 || isBlocked(event.currentTarget)) {
          reset();
          return;
        }
        const touch = Array.from(event.changedTouches).find((touch) => touch.identifier === initial.id);
        if (touch && isHomeSwipe(initial, { x: touch.clientX, y: touch.clientY })) {
          const home = event.currentTarget.querySelector<HTMLAnchorElement>("a.back-link");
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            home?.click();
          } else {
            setOffset(window.innerWidth);
            setPhase("leaving");
            timer.current = setTimeout(() => home?.click(), 200);
          }
        } else {
          reset();
        }
      }}>
      <article className="detail-sheet">
        {children}
      </article>
    </main>
  );
}
