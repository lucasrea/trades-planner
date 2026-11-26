"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

/** Shown when a page fails to render. Reports it when error tracking is on. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // A digest means the error happened on the server, which has already reported it.
    if (!error.digest) captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col text-ink">
        <title>Something went wrong · Trades Planner</title>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
          <div className="card w-full max-w-md px-8 py-10">
            <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted">This page couldn’t load. Try again.</p>
            <div className="mt-6 flex justify-center">
              <button type="button" className="btn btn-primary" onClick={() => retry()}>
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
