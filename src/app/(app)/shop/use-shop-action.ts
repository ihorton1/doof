"use client";

import { useState, useTransition } from "react";

export function useShopAction() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        console.error("Shopping update failed", error);
        setError("Could not update your shopping items. Please try again.");
      }
    });
  }
  return { isPending, error, run };
}
