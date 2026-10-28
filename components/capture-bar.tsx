"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "Quote Mrs Patel at 14 Elm, replace water heater, four hours labour, tank is 780.",
  "Invoice Chen for yesterday: two hours labour and a $45 valve.",
  "Log three hours on the kitchen rough-in.",
];

export function CaptureBar({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(next = text) {
    const trimmed = next.trim();
    if (!trimmed || pending) return;
    setText(next);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/captures/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(jobId ? { text: trimmed, jobId } : { text: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as {
        reviewUrl?: string;
        error?: { message?: string };
      } | null;
      if (response.status === 429) {
        setError(body?.error?.message ?? "You've hit the hourly limit.");
        return;
      }
      if (!response.ok || !body?.reviewUrl) {
        setError(body?.error?.message ?? "Couldn't send that. Your text is still here.");
        return;
      }
      router.push(body.reviewUrl);
    } catch {
      setError("Network error. Your text is still here.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card space-y-3 p-6">
      <div>
        <h2 className="text-lg font-semibold">Describe it</h2>
        <p className="mt-1 text-sm text-muted">Type the job. You’ll review the lines before anything is saved.</p>
      </div>
      <textarea
        className="input min-h-28"
        value={text}
        maxLength={4000}
        placeholder="Quote Mrs Patel at 14 Elm…"
        aria-label="Describe the job"
        disabled={pending}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => setText(example)}
          >
            {example.slice(0, 42)}…
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary" disabled={pending || !text.trim()} onClick={() => void submit()}>
        {pending ? "Reading…" : "Describe"}
      </button>
    </section>
  );
}
