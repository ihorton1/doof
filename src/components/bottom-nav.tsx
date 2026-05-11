"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Utensils, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/dishes", label: "Dishes", icon: Utensils },
  { href: "/shop", label: "Shop", icon: ShoppingCart },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4 max-w-3xl mx-auto">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-xs font-medium transition-colors",
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
