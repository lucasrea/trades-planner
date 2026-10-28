"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export type CaptureJobOption = {
  id: string;
  title: string;
  clientName: string | null;
};

export function CaptureBar({
  jobs = [],
  lockedJob,
  fill = false,
}: {
  jobs?: CaptureJobOption[];
  lockedJob?: CaptureJobOption;
  fill?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(lockedJob?.id ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = lockedJob ?? jobs.find((job) => job.id === jobId) ?? null;

  async function submit(next = text) {
    const trimmed = next.trim();
    if (!trimmed || pending) return;
    setText(next);
    setPending(true);
    setError(null);
    setMenuOpen(false);
    try {
      const assignedId = selected?.id;
      const response = await fetch("/api/captures/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(assignedId ? { text: trimmed, jobId: assignedId } : { text: trimmed }),
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
    <section className={fill ? "flex min-h-0 flex-1 flex-col" : "space-y-3"}>
      <div className={fill ? "flex min-h-0 flex-1 flex-col justify-end overflow-y-auto pb-4" : undefined}>
        {pending && text.trim() ? (
          <div className="mb-3 flex justify-end">
            <p className="max-w-[36rem] rounded-2xl bg-elevated px-4 py-3 text-sm leading-relaxed">{text.trim()}</p>
          </div>
        ) : null}
        {pending ? <p className="text-sm text-muted">Reading…</p> : null}
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="relative rounded-2xl border border-line bg-card p-2">
        {menuOpen && !lockedJob ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Close job list"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute bottom-full left-2 z-20 mb-2 max-h-64 w-72 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-elevated"
                onClick={() => {
                  setJobId(null);
                  setMenuOpen(false);
                }}
              >
                New job
              </button>
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-elevated"
                  onClick={() => {
                    setJobId(job.id);
                    setMenuOpen(false);
                  }}
                >
                  <span className="block text-sm">{job.title}</span>
                  {job.clientName ? <span className="block text-xs text-muted">{job.clientName}</span> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <textarea
          className="min-h-12 w-full resize-none bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
          value={text}
          maxLength={4000}
          rows={2}
          placeholder="Describe the work"
          aria-label="Message"
          disabled={pending}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          {lockedJob ? (
            <span className="truncate px-2 text-sm text-muted">{lockedJob.title}</span>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm max-w-[16rem] truncate"
              aria-expanded={menuOpen}
              aria-haspopup="listbox"
              disabled={pending}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {selected ? selected.title : "New job"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            aria-label="Send"
            disabled={pending || !text.trim()}
            onClick={() => void submit()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
