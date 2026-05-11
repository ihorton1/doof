"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={logout}
      className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
    >
      Sign out
    </button>
  );
}
