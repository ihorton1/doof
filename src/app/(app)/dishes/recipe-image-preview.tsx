"use client";

import { useState } from "react";

export function RecipeImagePreview({
  imageUrl,
  recipeName,
  onUse,
}: {
  imageUrl: string;
  recipeName: string;
  onUse: (imageUrl: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`Recipe image: ${recipeName}`}
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className="w-full max-h-64 object-contain rounded-lg border border-slate-300 dark:border-slate-700"
      />
      {status === "failed" ? (
        <p role="alert" className="text-sm text-rose-600">
          This recipe image could not be loaded. You can still import the ingredients.
        </p>
      ) : status === "loading" ? (
        <p className="text-xs text-slate-500">
          Loading recipe image...
        </p>
      ) : null}
      <button
        type="button"
        disabled={status !== "loaded"}
        onClick={() => onUse(imageUrl)}
        className="min-h-10 px-3 rounded-lg border border-emerald-600 text-sm text-emerald-700 dark:text-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Use image
      </button>
    </div>
  );
}
