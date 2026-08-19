"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-32 text-center">
      <TriangleAlert className="size-8 text-warn" />
      <h1 className="mt-5 font-display text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-fg-muted">
        This page failed to load. It is usually a hiccup talking to Riot&apos;s CDN — retrying
        often clears it.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-fg-subtle">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-canvas"
      >
        <RotateCcw className="size-4" />
        Try again
      </button>
    </div>
  );
}
