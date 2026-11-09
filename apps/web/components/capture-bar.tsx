"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Send, Square } from "lucide-react";
import { PlanProposalCard } from "@/components/plan-proposal-card";
import { useVoiceRecorder, type RecordedAudio } from "@/components/use-voice-recorder";
import { checkRecording, formatElapsed, uploadFilename, uploadMime } from "@/lib/captures/recorder";
import { PLAN_NEW } from "@/lib/plans";
import type { PlanThreadMessage } from "@/lib/services/plans";

export type CaptureJobOption = {
  id: string;
  title: string;
  clientName: string | null;
};

/** The open plan on the Plan screen. `id` is null for a new, empty thread. */
export type OpenPlan = { id: string | null; messages: PlanThreadMessage[] };

function PlanReply({ message, onCancelled }: { message: PlanThreadMessage; onCancelled: () => void }) {
  const reviewUrl = message.reviewUrl;
  const isReceipt = message.captureType === "receipt";
  if (message.outcome === "cancelled") return <p className="text-sm text-muted">Cancelled. Nothing was saved.</p>;
  if (message.outcome === "confirmed") {
    return (
      <p className="text-sm text-muted">
        Confirmed.{isReceipt ? "" : ` ${message.body}`}{" "}
        {reviewUrl ? (
          <Link href={reviewUrl} className="underline">
            Details
          </Link>
        ) : null}
      </p>
    );
  }
  if (message.preview && message.captureId && reviewUrl) {
    return (
      <PlanProposalCard captureId={message.captureId} reviewUrl={reviewUrl} preview={message.preview} onCancelled={onCancelled} />
    );
  }
  return (
    <p className="text-sm text-muted" role="status">
      {message.body}
      {isReceipt ? "" : " Your message is saved."}{" "}
      {reviewUrl ? (
        <Link href={reviewUrl} className="underline">
          {isReceipt && message.outcome === "waiting" ? "Review receipt" : "Add it yourself"}
        </Link>
      ) : null}
    </p>
  );
}

export function CaptureBar({
  jobs = [],
  lockedJob,
  fill = false,
  plan,
}: {
  jobs?: CaptureJobOption[];
  lockedJob?: CaptureJobOption;
  fill?: boolean;
  /** Plan screen only: the saved thread to show and add to. */
  plan?: OpenPlan;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(lockedJob?.id ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unsentAudio, setUnsentAudio] = useState<RecordedAudio | null>(null);
  const [reading, setReading] = useState(false);
  const [sentText, setSentText] = useState("");
  const selected = lockedJob ?? jobs.find((job) => job.id === jobId) ?? null;
  const recorder = useVoiceRecorder((audio) => void sendRecording(audio));
  const busy = pending || reading || refreshing;
  const planTarget = fill ? (plan?.id ?? PLAN_NEW) : null;

  /** Show the saved thread. A new plan gets its own address so a refresh stays on it. */
  function showPlan(savedPlanId: string | null | undefined) {
    startRefresh(() => {
      if (savedPlanId && savedPlanId !== plan?.id) router.replace(`/app?plan=${encodeURIComponent(savedPlanId)}`);
      else router.refresh();
    });
  }

  async function sendRecording(audio: RecordedAudio) {
    setUnsentAudio(null);
    setError(null);
    setMenuOpen(false);
    const check = checkRecording(audio.blob.size);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setReading(true);
    try {
      const mime = uploadMime(audio.blob.type, audio.recorderMime);
      const form = new FormData();
      form.set("audio", new File([audio.blob], uploadFilename(mime), { type: mime }));
      if (selected?.id) form.set("jobId", selected.id);
      if (planTarget) form.set("planId", planTarget);
      setSentText("Voice message");
      const response = await fetch("/api/captures/voice", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as {
        captureId?: string;
        status?: string;
        reviewUrl?: string;
        transcript?: string;
        planId?: string | null;
        error?: { message?: string };
      } | null;
      if (response.status === 429) {
        setUnsentAudio(audio);
        setError(body?.error?.message ?? "You've hit the hourly limit.");
        return;
      }
      if (!response.ok || !body?.reviewUrl) {
        setUnsentAudio(audio);
        setError(body?.error?.message ?? "Couldn't send that recording. You can try again.");
        return;
      }
      if (!fill) {
        router.push(body.reviewUrl);
        return;
      }
      showPlan(body.planId);
    } catch {
      setUnsentAudio(audio);
      setError("Network error. Your recording is kept, so you can try again.");
    } finally {
      setReading(false);
    }
  }

  async function submit(next = text) {
    const trimmed = next.trim();
    if (!trimmed || busy || recorder.recording) return;
    setText(next);
    setPending(true);
    setError(null);
    setMenuOpen(false);
    try {
      const assignedId = selected?.id;
      setSentText(trimmed);
      const response = await fetch("/api/captures/text", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          ...(assignedId ? { jobId: assignedId } : {}),
          ...(planTarget ? { planId: planTarget } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        captureId?: string;
        status?: string;
        reviewUrl?: string;
        planId?: string | null;
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
      if (!fill) {
        router.push(body.reviewUrl);
        return;
      }
      showPlan(body.planId);
      setText("");
    } catch {
      setError("Network error. Your text is still here.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={fill ? "flex min-h-0 flex-1 flex-col" : "space-y-3"}>
      <div className={fill ? "flex min-h-0 flex-1 flex-col justify-end overflow-y-auto pb-4" : undefined}>
        {(plan?.messages ?? []).map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="mb-3 flex justify-end">
              <p className="max-w-[36rem] whitespace-pre-line rounded-2xl bg-elevated px-4 py-3 text-sm leading-relaxed">
                {message.body}
              </p>
            </div>
          ) : (
            <div key={message.id} className="mb-3">
              <PlanReply message={message} onCancelled={() => startRefresh(() => router.refresh())} />
            </div>
          ),
        )}
        {(pending || reading || refreshing) && sentText ? (
          <div className="mb-3 flex justify-end">
            <p className="max-w-[36rem] whitespace-pre-line rounded-2xl bg-elevated px-4 py-3 text-sm leading-relaxed">{sentText}</p>
          </div>
        ) : null}
        {busy ? <p className="text-sm text-muted">Reading…</p> : null}
        {recorder.error || error ? (
          <p className="text-sm text-accent" role="alert">
            {error ?? recorder.error}
          </p>
        ) : null}
        {unsentAudio && !busy ? (
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void sendRecording(unsentAudio)}>
              Try sending again
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUnsentAudio(null)}>
              Discard recording
            </button>
          </div>
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
          disabled={busy}
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
              disabled={busy || recorder.recording}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {selected ? selected.title : "New job"}
            </button>
          )}
          <div className="flex items-center gap-2">
            {recorder.recording ? (
              <span className="text-sm tabular-nums text-muted" role="timer" aria-label="Recording time">
                {formatElapsed(recorder.elapsedMs)}
              </span>
            ) : null}
            {recorder.supported ? (
              <button
                type="button"
                className={recorder.recording ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                aria-label={recorder.recording ? "Stop recording" : "Record"}
                disabled={busy}
                onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
              >
                {recorder.recording ? <Square size={16} /> : <Mic size={16} />}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              aria-label="Send"
              disabled={busy || recorder.recording || !text.trim()}
              onClick={() => void submit()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
