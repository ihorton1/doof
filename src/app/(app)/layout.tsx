import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { LogoutButton } from "@/components/logout-button";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 pt-[env(safe-area-inset-top)]">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link href="/today" className="text-lg font-bold tracking-tight">
            doof
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-4 pb-6 min-h-0">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
