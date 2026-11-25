"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Mic, Send, Square, XCircle } from "lucide-react";
import { PlanProposalCard } from "@/components/plan-proposal-card";
import { useVoiceRecorder, type RecordedAudio } from "@/components/use-voice-recorder";
import { checkRecording, formatElapsed, uploadFilename, uploadMime } from "@/lib/captures/recorder";
import { parsePlanStreamLine, type PlanDoneEvent } from "@/lib/http/plan-events";
import { PLAN_NEW } from "@/lib/plans";
import type { PlanThreadMessage } from "@/lib/services/plans";

const STARTER_PROMPTS = [
  "What unbilled work do I have?",
  "Log 2 hours of labour and $150 in materials",
  "Quote a water heater replacement for a new client",
];

export type CaptureJobOption = {
  id: string;
  title: string;
  clientName: string | null;
};

/** The open plan on the Plan screen. `id` is null for a new, empty thread. */
export type OpenPlan = { id: string | null; messages: PlanThreadMessage[]; jobId?: string | null };

type SentBody = {
  ok: boolean;
  statusCode: number;
  reviewUrl?: string;
  planId?: string | null;
  reply?: string | null;
  message?: string;
};

async function readPlanBody(response: Response, onStatus: (text: string) => void): Promise<SentBody> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/x-ndjson") || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      reviewUrl?: string;
      planId?: string | null;
      reply?: string | null;
      error?: { message?: string };
    } | null;
    return {
      ok: response.ok && Boolean(body?.reviewUrl),
      statusCode: response.status,
      reviewUrl: body?.reviewUrl,
      planId: body?.planId,
      reply: body?.reply,
      message: body?.error?.message,
    };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const found: { done: PlanDoneEvent | null } = { done: null };
  const take = (line: string) => {
    const event = parsePlanStreamLine(line);
    if (!event) return;
    if (event.type === "status") onStatus(event.text);
    if (event.type === "done") found.done = event;
    if (event.type === "error") {
      found.done = null;
      throw Object.assign(new Error(event.message), { statusCode: event.status });
    }
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) take(line);
    }
    take(buffer);
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 500;
    return { ok: false, statusCode, message: error instanceof Error ? error.message : "Couldn't send that. Your text is still here." };
  }
  const done = found.done;
  if (!done) return { ok: false, statusCode: 500, message: "Couldn't send that. Your text is still here." };
  return { ok: Boolean(done.reviewUrl), statusCode: 200, reviewUrl: done.reviewUrl, planId: done.planId, reply: done.reply };
}

function PlanReply({
  message,
  onCancelled,
  onChoose,
}: {
  message: PlanThreadMessage;
  onCancelled: () => void;
  /** Set only on the latest question, so old choices can't be tapped. */
  onChoose?: (label: string, jobId: string | null) => void;
}) {
  const reviewUrl = message.reviewUrl;
  const isReceipt = message.captureType === "receipt";
  if (message.outcome === "cancelled") {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl border border-line bg-navy-2 px-3 py-2 text-sm text-muted">
        <XCircle size={15} className="shrink-0 text-muted" aria-hidden />
        <span>Cancelled. Nothing was saved.</span>
      </p>
    );
  }
  if (message.outcome === "confirmed") {
    return (
      <p className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-ok/25 bg-ok/10 px-3 py-2 text-sm text-ink">
        <CheckCircle2 size={15} className="shrink-0 text-ok" aria-hidden />
        <span>
          Confirmed.{isReceipt ? "" : ` ${message.body}`}{" "}
          {reviewUrl ? (
            <Link href={reviewUrl} className="font-medium text-ink underline decoration-ink/40 underline-offset-2 hover:decoration-ink">
              Details
            </Link>
          ) : null}
        </span>
      </p>
    );
  }
  if (!message.captureId && message.options.length > 0) {
    return (
      <div className="max-w-[40rem] space-y-2">
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{message.body}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choices">
          {message.options.map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={!onChoose}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/60 hover:bg-elevated disabled:cursor-default disabled:opacity-60 disabled:hover:border-line disabled:hover:bg-card"
              onClick={() => onChoose?.(option.label, option.jobId)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!message.captureId) {
    return <p className="max-w-[40rem] whitespace-pre-line text-sm leading-relaxed text-ink">{message.body}</p>;
  }
  if (message.preview && message.captureId && reviewUrl) {
    return (
      <PlanProposalCard captureId={message.captureId} reviewUrl={reviewUrl} preview={message.preview} onCancelled={onCancelled} />
    );
  }
  return (
    <p className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm text-muted" role="status">
      <AlertCircle size={15} className="shrink-0 text-danger" aria-hidden />
      <span>
        {message.body}
        {isReceipt ? "" : " Your message is saved."}{" "}
        {reviewUrl ? (
          <Link href={reviewUrl} className="font-medium text-ink underline decoration-ink/40 underline-offset-2 hover:decoration-ink">
            {isReceipt && message.outcome === "waiting" ? "Review receipt" : "Add it yourself"}
          </Link>
        ) : null}
      </span>
    </p>
  );
}

export function CaptureBar({
  jobs = [],
  lockedJob,
  fill = false,
  plan,
  dock,
}: {
  jobs?: CaptureJobOption[];
  lockedJob?: CaptureJobOption;
  fill?: boolean;
  /** Plan screen only: the saved thread to show and add to. */
  plan?: OpenPlan;
  /** Plan screen only: controls tucked above the composer (e.g. receipt upload). */
  dock?: ReactNode;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(lockedJob?.id ?? plan?.jobId ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unsentAudio, setUnsentAudio] = useState<RecordedAudio | null>(null);
  const [reading, setReading] = useState(false);
  const [sentText, setSentText] = useState("");
  const [statusText, setStatusText] = useState("Reading your message");
  const selected = lockedJob ?? jobs.find((job) => job.id === jobId) ?? null;
  const recorder = useVoiceRecorder((audio) => void sendRecording(audio));
  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  // Two Enter presses can land before React re-renders with `pending`. This guard is synchronous.
  const sendingRef = useRef(false);
  const persistedCount = plan?.messages.length ?? 0;
  const lastSavedCount = useRef(persistedCount);
  // Network work only. Refresh can keep the optimistic bubble/status without locking the composer.
  const sending = pending || reading;
  const busy = sending || refreshing;

  useEffect(() => {
    if (persistedCount !== lastSavedCount.current) {
      lastSavedCount.current = persistedCount;
      setSentText("");
    }
  }, [persistedCount]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const threadKey = `${persistedCount}:${plan?.messages.at(-1)?.id ?? ""}:${sentText}:${statusText}`;
  useEffect(() => {
    const el = threadRef.current;
    if (!el || !stickToBottom.current) return;
    const scroll = () => {
      el.scrollTop = el.scrollHeight;
    };
    scroll();
    const frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [threadKey]);
  const planTarget = fill ? (plan?.id ?? PLAN_NEW) : null;

  /** Show the saved thread. A new plan gets its own address so a refresh stays on it. */
  function showPlan(savedPlanId: string | null | undefined) {
    startRefresh(() => {
      if (savedPlanId && savedPlanId !== plan?.id) router.replace(`/app?plan=${encodeURIComponent(savedPlanId)}`);
      else router.refresh();
    });
  }

  /**
   * After a message is handled. If the thread could not be saved (planId null), a refresh would show
   * nothing, so open the card's review page or keep the answer on screen instead of dropping it.
   */
  function land(result: { planId?: string | null; reviewUrl?: string; reply?: string | null }) {
    if (!fill || (planTarget && !result.planId)) {
      if (result.reply) {
        setSentText("");
        setAnswer(result.reply);
        return;
      }
      if (result.reviewUrl && result.reviewUrl !== "/app") {
        setSentText("");
        router.push(result.reviewUrl);
        return;
      }
    }
    showPlan(result.planId);
  }

  async function sendRecording(audio: RecordedAudio) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setUnsentAudio(null);
    setError(null);
    setMenuOpen(false);
    const check = checkRecording(audio.blob.size);
    if (!check.ok) {
      sendingRef.current = false;
      setError(check.message);
      return;
    }
    stickToBottom.current = true;
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
        reply?: string | null;
        error?: { message?: string };
      } | null;
      if (response.status === 429) {
        setSentText("");
        setUnsentAudio(audio);
        setError(body?.error?.message ?? "You've hit the hourly limit.");
        return;
      }
      if (!response.ok || !body?.reviewUrl) {
        setSentText("");
        setUnsentAudio(audio);
        setError(body?.error?.message ?? "Couldn't send that recording. You can try again.");
        return;
      }
      setAnswer(null);
      land(body);
    } catch {
      setSentText("");
      setUnsentAudio(audio);
      setError("Network error. Your recording is kept, so you can try again.");
    } finally {
      sendingRef.current = false;
      setReading(false);
    }
  }

  async function submit(next = text, jobOverride?: string | null) {
    const trimmed = next.trim();
    if (!trimmed || sending || recorder.recording || sendingRef.current) return;
    sendingRef.current = true;
    stickToBottom.current = true;
    setText("");
    setPending(true);
    setError(null);
    setAnswer(null);
    setMenuOpen(false);
    setSentText(trimmed);
    setStatusText("Reading your message");
    try {
      // A tapped choice that is a job becomes the job for this message.
      const assignedId = jobOverride ?? selected?.id;
      const response = await fetch("/api/captures/text", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/x-ndjson" },
        body: JSON.stringify({
          text: trimmed,
          ...(assignedId ? { jobId: assignedId } : {}),
          ...(planTarget ? { planId: planTarget } : {}),
        }),
      });
      const body = await readPlanBody(response, setStatusText);
      if (body.statusCode === 429) {
        setSentText("");
        setText((current) => current || trimmed);
        setError(body.message ?? "You've hit the hourly limit.");
        return;
      }
      if (body.statusCode === 404) {
        setSentText("");
        setText((current) => current || trimmed);
        setError(body.message ?? "Job not found.");
        return;
      }
      if (!body.ok || !body.reviewUrl) {
        setSentText("");
        setText((current) => current || trimmed);
        setError(body.message ?? "Couldn't send that. Your text is still here.");
        return;
      }
      land(body);
    } catch {
      setSentText("");
      setText((current) => current || trimmed);
      setError("Network error. Your text is still here.");
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  const isEmptyThread = fill && (plan?.messages.length ?? 0) === 0 && !sentText && !busy;

  const composer = (
    <div className="relative rounded-2xl border border-line bg-card p-2 transition focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
      {menuOpen && !lockedJob ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close job list"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute bottom-full left-2 z-20 mb-2 max-h-64 w-72 overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-2xl">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-elevated"
              onClick={() => {
                setJobId(null);
                setMenuOpen(false);
              }}
            >
              <span>New job</span>
              {!selected ? <Check size={14} className="shrink-0 text-accent" aria-hidden /> : null}
            </button>
            {jobs.map((job) => {
              const active = selected?.id === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-elevated"
                  onClick={() => {
                    setJobId(job.id);
                    setMenuOpen(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{job.title}</span>
                    {job.clientName ? <span className="block truncate text-xs text-muted">{job.clientName}</span> : null}
                  </span>
                  {active ? <Check size={14} className="shrink-0 text-accent" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      <textarea
        ref={textareaRef}
        className="min-h-12 max-h-40 w-full resize-none overflow-y-auto bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
        value={text}
        maxLength={4000}
        rows={2}
        placeholder="Describe the work"
        aria-label="Message"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!sending && !recorder.recording) void submit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        {lockedJob ? (
          <span className="inline-flex max-w-[16rem] items-center gap-1.5 truncate px-2 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            <span className="truncate">{lockedJob.title}</span>
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm max-w-[16rem]"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            disabled={sending || recorder.recording}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {selected ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden /> : null}
            <span className="truncate">{selected ? selected.title : "New job"}</span>
            <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
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
              disabled={sending}
              onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            >
              {recorder.recording ? <Square size={16} /> : <Mic size={16} />}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            aria-label="Send"
            disabled={sending || recorder.recording || !text.trim()}
            onClick={() => void submit()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section className={fill ? "mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col" : "space-y-3"}>
      <div
        ref={threadRef}
        className={fill ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : undefined}
        onScroll={
          fill
            ? () => {
                const el = threadRef.current;
                if (!el) return;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              }
            : undefined
        }
      >
        <div className={fill ? `flex min-h-full flex-col ${isEmptyThread ? "justify-center" : "justify-end"} pb-2` : undefined}>
          {isEmptyThread ? (
            <div className="mx-auto my-auto max-w-lg py-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">What are we working on?</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Describe a job, log hours or materials, check unbilled work, or snap a receipt. Nothing saves until you confirm.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line hover:bg-elevated hover:text-ink"
                    onClick={() => {
                      setText(prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {(plan?.messages ?? []).map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="mb-3 flex justify-end">
                <p className="max-w-[36rem] whitespace-pre-line rounded-2xl border border-line bg-elevated px-4 py-3 text-sm leading-relaxed text-ink">
                  {message.body}
                </p>
              </div>
            ) : (
              <div key={message.id} className="mb-3">
                <PlanReply
                  message={message}
                  onCancelled={() => startRefresh(() => router.refresh())}
                  onChoose={
                    message.id === plan?.messages.at(-1)?.id && !busy
                      ? (label, jobId) => {
                          if (jobId && !lockedJob) setJobId(jobId);
                          void submit(label, jobId);
                        }
                      : undefined
                  }
                />
              </div>
            ),
          )}
          {(pending || reading || refreshing) && sentText ? (
            <div className="mb-3 flex justify-end">
              <p className="max-w-[36rem] whitespace-pre-line rounded-2xl border border-line bg-elevated px-4 py-3 text-sm leading-relaxed text-ink">
                {sentText}
              </p>
            </div>
          ) : null}
          {busy ? (
            <div className="mb-3 flex items-center gap-2" role="status" aria-live="polite" aria-label={pending ? statusText : "Reading"}>
              <span className="inline-flex items-center gap-1 rounded-2xl border border-line bg-card px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
              </span>
              {pending ? <span className="text-sm text-muted">{statusText}</span> : null}
            </div>
          ) : null}
          {answer ? <p className="mb-3 max-w-[40rem] whitespace-pre-line text-sm leading-relaxed text-ink">{answer}</p> : null}
          {recorder.error || error ? (
            <p className="mb-2 text-sm text-danger" role="alert">
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
      </div>
      {fill ? (
        <div className="shrink-0 space-y-2 pt-2">
          {dock}
          {composer}
        </div>
      ) : (
        composer
      )}
    </section>
  );
}
