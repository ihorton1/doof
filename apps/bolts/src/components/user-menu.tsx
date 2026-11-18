"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { logout } from "../app/login/actions";

export function UserMenu() {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    function escape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <details className="user-menu" ref={menuRef}>
      <summary aria-label="User menu">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
        <span aria-hidden="true">&#9662;</span>
      </summary>
      <div className="user-menu-panel">
        <Link href="/settings" className="user-menu-item">Settings</Link>
        <form action={logout}><button className="user-menu-item">Sign out</button></form>
      </div>
    </details>
  );
}
