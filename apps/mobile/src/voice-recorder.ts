import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";

export const MAX_RECORDING_MS = 120_000;

/** Mono AAC in an .m4a file at 64 kbps: two minutes is about 1 MB, inside the route's 4 MB. */
const RECORDING: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64_000 };

export function formatElapsed(elapsedMs: number) {
  const seconds = Math.floor(Math.min(Math.max(0, elapsedMs), MAX_RECORDING_MS) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Microphone recording that stops by itself at two minutes. Calls `onRecorded` once per finished
 * recording and never uploads. `interrupted` means the app left the screen, so don't send unasked.
 */
export function useVoiceRecorder(onRecorded: (uri: string, interrupted: boolean) => void) {
  const recorder = useAudioRecorder(RECORDING);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const phaseRef = useRef<"idle" | "starting" | "recording" | "stopping">("idle");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbackRef = useRef(onRecorded);
  useEffect(() => {
    callbackRef.current = onRecorded;
  });

  const stopTicking = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const finish = useCallback(
    async (interrupted: boolean) => {
      if (phaseRef.current !== "recording") return;
      phaseRef.current = "stopping";
      stopTicking();
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        if (recorder.uri) callbackRef.current(recorder.uri, interrupted);
        else setError("Nothing was recorded. Try again, or type your message.");
      } catch {
        setError("Recording failed. You can still type your message.");
      } finally {
        phaseRef.current = "idle";
        setRecording(false);
      }
    },
    [recorder, stopTicking],
  );

  const start = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    phaseRef.current = "starting";
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        phaseRef.current = "idle";
        setError("Microphone access is blocked. Allow it in your phone's settings, or type your message.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // The native limit is a backstop for when timers pause; the timer below normally stops first.
      recorder.record({ forDuration: MAX_RECORDING_MS / 1000 + 1 });
    } catch {
      phaseRef.current = "idle";
      setError("Recording isn't available. You can still type your message.");
      return;
    }
    phaseRef.current = "recording";
    const startedAt = Date.now();
    setElapsedMs(0);
    setRecording(true);
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS) void finish(false);
    }, 250);
  }, [finish, recorder]);

  const stop = useCallback(() => void finish(false), [finish]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") void finish(true);
    });
    return () => subscription.remove();
  }, [finish]);

  useEffect(() => stopTicking, [stopTicking]);

  return { recording, elapsedMs, error, start, stop };
}
