"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MAX_RECORDING_MS,
  RECORDER_BITS_PER_SECOND,
  clampElapsedMs,
  pickRecorderMime,
} from "@/lib/captures/recorder";

export type RecordedAudio = { blob: Blob; recorderMime: string | undefined };

const noopSubscribe = () => () => {};
const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/** Browser microphone recording. Calls onRecorded once per finished recording; never uploads. */
export function useVoiceRecorder(onRecorded: (audio: RecordedAudio) => void) {
  const supported = useSyncExternalStore(noopSubscribe, canRecord, () => false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const cancelledRef = useRef(false);
  const callbackRef = useRef(onRecorded);
  useEffect(() => {
    callbackRef.current = onRecorded;
  });

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current || startingRef.current || !canRecord()) return;
    startingRef.current = true;
    cancelledRef.current = false;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      startingRef.current = false;
      const denied = caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "SecurityError");
      setError(
        denied
          ? "Microphone access is blocked. You can still type your message."
          : "No microphone found. You can still type your message.",
      );
      return;
    }
    startingRef.current = false;
    if (cancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    let recorder: MediaRecorder;
    const mime = pickRecorderMime((type) => MediaRecorder.isTypeSupported(type));
    try {
      recorder = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: RECORDER_BITS_PER_SECOND,
      });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError("Recording isn't supported here. You can still type your message.");
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    setElapsedMs(0);
    setRecording(true);

    const tick = window.setInterval(() => setElapsedMs(clampElapsedMs(Date.now() - startedAt)), 250);
    const cap = window.setTimeout(stop, MAX_RECORDING_MS);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      cancelledRef.current = true;
      setError("Recording failed. You can still type your message.");
      if (recorder.state !== "inactive") recorder.stop();
    };
    recorder.onstop = () => {
      window.clearInterval(tick);
      window.clearTimeout(cap);
      releaseStream();
      recorderRef.current = null;
      setRecording(false);
      setElapsedMs(clampElapsedMs(Date.now() - startedAt));
      if (cancelledRef.current) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || "" });
      callbackRef.current({ blob, recorderMime: recorder.mimeType || mime });
    };
    recorder.start();
  }, [releaseStream, stop]);

  // Leaving the page discards an in-progress recording and frees the microphone.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseStream();
    };
  }, [releaseStream]);

  return { supported, recording, elapsedMs, error, start, stop };
}
