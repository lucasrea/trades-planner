"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import type { CaptureJobOption } from "@/components/capture-bar";
import { downscaleToJpeg } from "@/lib/captures/downscale";

export function ReceiptUpload({
  jobs = [],
  lockedJob,
  planId,
  compact = false,
}: {
  jobs?: CaptureJobOption[];
  lockedJob?: CaptureJobOption;
  /** Plan screen only: the open plan's id, or "new". The receipt is added to that plan. */
  planId?: string;
  /** Tighter spacing when shown above the plan composer. */
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [note, setNote] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState<"preparing" | "sending" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("preparing");
    try {
      const blob = await downscaleToJpeg(file);
      setPhoto({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch {
      setError("Couldn't open that photo. Try a JPEG, PNG, or WebP image.");
    } finally {
      setBusy(null);
    }
  }

  function clear() {
    setPhoto(null);
    setNote("");
    setError(null);
  }

  async function send() {
    if (!photo || busy) return;
    setBusy("sending");
    setError(null);
    try {
      const form = new FormData();
      form.set("image", new File([photo.blob], "receipt.jpg", { type: "image/jpeg" }));
      const assignedId = lockedJob?.id ?? jobId;
      if (assignedId) form.set("jobId", assignedId);
      if (note.trim()) form.set("note", note.trim());
      if (planId) form.set("planId", planId);
      const response = await fetch("/api/captures/receipt", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as { reviewUrl?: string; error?: { message?: string } } | null;
      if (!response.ok || !body?.reviewUrl) {
        setError(body?.error?.message ?? "Couldn't send that photo. It is still here.");
        return;
      }
      router.push(body.reviewUrl);
    } catch {
      setError("Network error. The photo is still here.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={compact ? "space-y-2" : "space-y-3"} aria-label="Receipt photo">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Receipt photo file"
        data-testid="receipt-file-input"
        onChange={(event) => void onPick(event)}
      />
      {photo ? (
        <div className="card space-y-3 p-3">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={photo.previewUrl} alt="Receipt preview" className="h-24 w-24 rounded-lg border border-line object-cover" />
            <div className="min-w-0 flex-1 space-y-2">
              <input
                className="input w-full"
                aria-label="Note about this receipt"
                maxLength={500}
                placeholder='Optional: "add this to the kitchen"'
                value={note}
                disabled={busy === "sending"}
                onChange={(event) => setNote(event.target.value)}
              />
              {lockedJob ? (
                <p className="truncate text-sm text-muted">Goes on {lockedJob.title}</p>
              ) : (
                <select
                  className="input w-full"
                  aria-label="Job for this receipt"
                  value={jobId}
                  disabled={busy === "sending"}
                  onChange={(event) => setJobId(event.target.value)}
                >
                  <option value="">Choose a job on the next screen</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void send()}>
              {busy === "sending" ? "Reading receipt…" : "Read receipt"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy === "sending"} onClick={clear}>
              Remove photo
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
          <Camera className="mr-1 inline h-4 w-4" aria-hidden />
          {busy === "preparing" ? "Preparing photo…" : "Add a receipt photo"}
        </button>
      )}
      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
