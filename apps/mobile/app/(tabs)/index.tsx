import { type ComponentRef, useCallback, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  cancelCapture,
  confirmCapture,
  fetchPlanThread,
  listOpenJobs,
  listPlans,
  sendReceiptCapture,
  sendTextCapture,
  sendVoiceCapture,
  updateCaptureLines,
  type JobListItem,
  type PlanLineEdit,
  type TextCaptureResult,
} from "../../src/api";
import { confirmedScreen } from "../../src/links";
import { OptionSheet } from "../../src/option-sheet";
import { PlanPickerSheet } from "../../src/plan-picker-sheet";
import { PlanReply, type CardAction } from "../../src/plan-reply";
import { ReceiptPanel } from "../../src/receipt-panel";
import { localTurn, PLAN_NEW, type PlanSummary, type PlanThreadMessage } from "../../src/plans";
import { getBearer } from "../../src/session";
import { GhostButton, Notice, SecondaryButton, StatusPill } from "../../src/ui";
import { colors } from "../../src/theme";
import { formatElapsed, useVoiceRecorder } from "../../src/voice-recorder";

/** The picker's "no job chosen" row. */
const NO_JOB = "";

const STARTER_PROMPTS = [
  "What unbilled work do I have?",
  "Log 2 hours of labour and $150 in materials",
  "Quote a water heater replacement for a new client",
];

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<PlanThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [sentText, setSentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState<CardAction | null>(null);
  const [cardError, setCardError] = useState<{ captureId: string; message: string } | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  /** The job messages are about, as chosen in the composer. */
  const [job, setJob] = useState<{ id: string; title: string } | null>(null);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);
  const [openJobs, setOpenJobs] = useState<JobListItem[]>([]);
  const [jobsStatus, setJobsStatus] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  /** A recording that has not reached the server, kept so it can be sent again. */
  const [unsentAudio, setUnsentAudio] = useState<string | null>(null);

  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  /** One request at a time: a send or a card action. */
  const inFlightRef = useRef(false);
  /** The plan on screen, so a slow answer for another plan is not drawn over it. */
  const openPlanRef = useRef<string | null>(null);

  const syncThread = useCallback(async (id: string) => {
    const bearer = await getBearer();
    if (!bearer) return null;
    const thread = await fetchPlanThread(bearer, id);
    if (openPlanRef.current !== id) return null;
    setPlanId(thread.id);
    setThreadMessages(thread.messages);
    return thread;
  }, []);

  /** Switching to a plan also picks up the job it is about, as the web does. */
  const adoptPlanJob = useCallback((thread: Awaited<ReturnType<typeof syncThread>>) => {
    if (!thread) return;
    setJob(thread.jobId && thread.jobTitle ? { id: thread.jobId, title: thread.jobTitle } : null);
  }, []);

  // Coming back from a receipt or a document, a card may have changed.
  const hasLocalRows = threadMessages.some((row) => row.id.startsWith("local-"));
  useFocusEffect(
    useCallback(() => {
      const id = openPlanRef.current;
      if (id && !inFlightRef.current && !hasLocalRows) void syncThread(id).catch(() => undefined);
    }, [hasLocalRows, syncThread]),
  );

  const openPlans = useCallback(async () => {
    setPickerOpen(true);
    setPlansLoading(true);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setPlans([]);
        return;
      }
      setPlans(await listPlans(bearer));
    } catch {
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const openJobSheet = useCallback(async () => {
    setJobSheetOpen(true);
    setJobsStatus("Loading…");
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setJobsStatus("Sign in on the Settings tab first.");
        return;
      }
      const rows = await listOpenJobs(bearer);
      setOpenJobs(rows);
      setJobsStatus(rows.length ? null : "No open jobs yet.");
    } catch (err) {
      setJobsStatus(err instanceof Error ? err.message : "Could not load jobs.");
    }
  }, []);

  const clearNotes = useCallback(() => {
    setError(null);
    setNotice(null);
    setCardError(null);
    setSentText(null);
  }, []);

  const selectPlan = useCallback(
    async (id: string) => {
      clearNotes();
      setReceiptOpen(false);
      setUnsentAudio(null);
      openPlanRef.current = id;
      setThreadLoading(true);
      try {
        adoptPlanJob(await syncThread(id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this plan.");
        setThreadMessages([]);
        setPlanId(null);
        openPlanRef.current = null;
      } finally {
        setThreadLoading(false);
      }
    },
    [adoptPlanJob, clearNotes, syncThread],
  );

  const startNewPlan = useCallback(() => {
    clearNotes();
    setReceiptOpen(false);
    setUnsentAudio(null);
    openPlanRef.current = null;
    setPlanId(null);
    setThreadMessages([]);
    setJob(null);
  }, [clearNotes]);

  /** Show a saved plan after a message went through. False when it couldn't be loaded. */
  const showPlan = useCallback(
    async (id: string) => {
      const isNew = openPlanRef.current !== id;
      openPlanRef.current = id;
      setPlanId(id);
      try {
        const thread = await syncThread(id);
        if (isNew) adoptPlanJob(thread);
        return true;
      } catch {
        return false;
      }
    },
    [adoptPlanJob, syncThread],
  );

  /** A typed or spoken message: one request at a time, then the saved thread (or the answer itself). */
  const runMessage = useCallback(
    async (input: {
      status: string;
      said?: string;
      call: (bearer: string, planId: string) => Promise<TextCaptureResult>;
      onFail: () => void;
    }) => {
      if (inFlightRef.current) return input.onFail();
      inFlightRef.current = true;
      setBusy(true);
      clearNotes();
      setReading(input.status);
      setSentText(input.said ?? null);
      const startedOn = openPlanRef.current;
      try {
        const bearer = await getBearer();
        if (!bearer) {
          setSentText(null);
          input.onFail();
          setError("Sign in on the Settings tab first.");
          return;
        }
        const result = await input.call(bearer, planId ?? PLAN_NEW);
        if (openPlanRef.current !== startedOn) return;
        // The message went through. If only the reload fails, show the answer from this response.
        const saved = result.planId ? await showPlan(result.planId) : false;
        const said = input.said ?? (result.transcript || "Voice message");
        if (!saved) setThreadMessages((rows) => [...rows, ...localTurn(said, result)]);
        setSentText(null);
        if (result.status === "failed" && !result.planId) {
          input.onFail();
          setError("We could not read that message.");
        }
      } catch (err) {
        setSentText(null);
        input.onFail();
        setError(err instanceof Error ? err.message : "Send failed.");
      } finally {
        setReading(null);
        setBusy(false);
        inFlightRef.current = false;
      }
    },
    [clearNotes, planId, showPlan],
  );

  const send = useCallback(
    (message: string, options?: { jobId?: string | null; fromComposer?: boolean }) => {
      const trimmed = message.trim();
      if (!trimmed || inFlightRef.current) return;
      if (options?.fromComposer) setText("");
      const jobId = options?.jobId ?? job?.id;
      void runMessage({
        status: "Reading your message…",
        said: trimmed,
        call: (bearer, target) => sendTextCapture(bearer, trimmed, { planId: target, jobId }),
        onFail: () => {
          if (options?.fromComposer) setText((current) => current || trimmed);
        },
      });
    },
    [job, runMessage],
  );

  const sendRecording = useCallback(
    (uri: string) => {
      setUnsentAudio(null);
      void runMessage({
        status: "Reading your recording…",
        call: (bearer, target) => sendVoiceCapture(bearer, uri, { planId: target, jobId: job?.id }),
        onFail: () => setUnsentAudio(uri),
      });
    },
    [job, runMessage],
  );

  const recorder = useVoiceRecorder((uri, interrupted) => {
    if (interrupted) setUnsentAudio(uri);
    else sendRecording(uri);
  });

  const sendReceipt = useCallback(
    async (uri: string, note: string) => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setBusy(true);
      clearNotes();
      try {
        const bearer = await getBearer();
        if (!bearer) {
          setError("Sign in on the Settings tab first.");
          return false;
        }
        const result = await sendReceiptCapture(bearer, uri, { planId: planId ?? PLAN_NEW, jobId: job?.id, note });
        if (result.planId) await showPlan(result.planId);
        router.push(`/receipt/${result.captureId}`);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send that photo. It is still here.");
        return false;
      } finally {
        setBusy(false);
        inFlightRef.current = false;
      }
    },
    [clearNotes, job, planId, showPlan],
  );

  /** Run one card's server call, then show the saved thread. Resolves false when the server refused. */
  const runCard = useCallback(
    async (action: CardAction, work: (bearer: string) => Promise<Partial<PlanThreadMessage>>) => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      setBusy(true);
      setWorking(action);
      setError(null);
      setNotice(null);
      setCardError(null);
      const apply = (patch: Partial<PlanThreadMessage>) =>
        setThreadMessages((rows) =>
          rows.map((row) => (row.role === "plan" && row.captureId === action.captureId ? { ...row, ...patch } : row)),
        );
      try {
        const bearer = await getBearer();
        if (!bearer) {
          setCardError({ captureId: action.captureId, message: "Sign in on the Settings tab first." });
          return false;
        }
        apply(await work(bearer));
        if (planId) await syncThread(planId).catch(() => undefined);
        return true;
      } catch (err) {
        setCardError({ captureId: action.captureId, message: err instanceof Error ? err.message : "That didn't work." });
        // A refusal can mean the card changed elsewhere (confirmed on the web, for one).
        if (planId) await syncThread(planId).catch(() => undefined);
        return false;
      } finally {
        setWorking(null);
        setBusy(false);
        inFlightRef.current = false;
      }
    },
    [planId, syncThread],
  );

  const onConfirm = useCallback(
    async (captureId: string) => {
      let next: string | null = null;
      const ok = await runCard({ captureId, kind: "confirm" }, async (bearer) => {
        const result = await confirmCapture(bearer, captureId);
        next = confirmedScreen(result);
        if (result.kind === "done") setNotice(result.message);
        return { outcome: "confirmed", preview: null };
      });
      // withAnchor keeps the list under the detail screen, so Back works from the other tab.
      if (ok && next) router.push(next, { withAnchor: true });
    },
    [runCard],
  );

  const onCancel = useCallback(
    (captureId: string) =>
      void runCard({ captureId, kind: "cancel" }, async (bearer) => {
        await cancelCapture(bearer, captureId);
        return { outcome: "cancelled", preview: null };
      }),
    [runCard],
  );

  const onSaveLines = useCallback(
    (captureId: string, lines: PlanLineEdit[]) =>
      runCard({ captureId, kind: "save" }, async (bearer) => ({
        preview: await updateCaptureLines(bearer, captureId, lines),
      })),
    [runCard],
  );

  const lastMessageId = threadMessages.at(-1)?.id;

  const hasThread = threadMessages.length > 0;
  const hasPending = Boolean(sentText || error || reading);
  const isEmpty = !hasThread && !hasPending && !threadLoading;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            disabled={recorder.recording}
            onPress={() => void openPlans()}
            style={styles.plansBtn}
          >
            <Text style={styles.plansBtnLabel}>Plans</Text>
          </Pressable>
          <Text style={styles.brand}>Trades Planner</Text>
          {!isEmpty ? (
            <GhostButton label="New plan" disabled={recorder.recording} onPress={startNewPlan} />
          ) : (
            <View style={styles.topSpacer} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, isEmpty ? styles.scrollCentered : styles.scrollEnd]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!isEmpty) scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {threadLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Loading conversation…</Text>
            </View>
          ) : null}

          {isEmpty ? (
            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>What are we working on?</Text>
              <Text style={styles.welcomeBody}>
                Describe a job, log hours or materials, or check unbilled work. Nothing saves until you confirm.
              </Text>
              <View style={styles.chips}>
                {STARTER_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    accessibilityRole="button"
                    onPress={() => {
                      setText(prompt);
                      inputRef.current?.focus();
                    }}
                    style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
                  >
                    <Text style={styles.chipText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.thread}>
              {threadMessages.map((message) => (
                <View key={message.id}>
                  {message.role === "user" ? (
                    <View style={styles.userRow}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userText}>{message.body}</Text>
                      </View>
                    </View>
                  ) : (
                    <PlanReply
                      message={message}
                      working={working}
                      disabled={busy || recorder.recording}
                      error={cardError && cardError.captureId === message.captureId ? cardError.message : null}
                      onConfirm={(captureId) => void onConfirm(captureId)}
                      onCancel={onCancel}
                      onSaveLines={onSaveLines}
                      onChoose={
                        message.id === lastMessageId
                          ? (label, jobId) => {
                              const chosen = jobId ? openJobs.find((row) => row.id === jobId) : null;
                              if (jobId) setJob({ id: jobId, title: chosen?.title ?? label });
                              send(label, { jobId });
                            }
                          : undefined
                      }
                      onOpenReceipt={(captureId) => router.push(`/receipt/${captureId}`)}
                    />
                  )}
                </View>
              ))}

              {sentText ? (
                <View style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText}>{sentText}</Text>
                  </View>
                </View>
              ) : null}

              {reading ? (
                <View style={styles.thinkingRow}>
                  <StatusPill label={reading} tone="accent" />
                </View>
              ) : null}

              {notice ? <Notice tone="ok">{notice}</Notice> : null}
              {error ? <Notice>{error}</Notice> : null}
              {/* A card that left the thread (confirmed or cancelled elsewhere) can't carry its own error. */}
              {cardError && !threadMessages.some((row) => row.captureId === cardError.captureId && row.preview) ? (
                <Notice>{cardError.message}</Notice>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.composerWrap}>
          {receiptOpen ? (
            <ReceiptPanel
              jobTitle={job?.title ?? null}
              busy={busy}
              onSend={sendReceipt}
              onClose={() => setReceiptOpen(false)}
            />
          ) : null}
          {recorder.error ? <Notice>{recorder.error}</Notice> : null}
          {unsentAudio && !recorder.recording ? (
            <View style={styles.unsent}>
              <SecondaryButton size="sm" label="Send recording" disabled={busy} onPress={() => sendRecording(unsentAudio)} />
              <GhostButton label="Delete recording" disabled={busy} onPress={() => setUnsentAudio(null)} />
            </View>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Message"
              multiline
              maxLength={4000}
              onChangeText={setText}
              placeholder="Describe the work"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={text}
            />
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Job: ${job?.title ?? "New job"}`}
                disabled={recorder.recording}
                onPress={() => void openJobSheet()}
                style={({ pressed }) => [styles.job, pressed ? styles.jobPressed : null]}
              >
                <Text style={styles.jobLabel} numberOfLines={1}>
                  {job?.title ?? "New job"} ▾
                </Text>
              </Pressable>
              {recorder.recording ? (
                <>
                  <Text style={styles.timer} accessibilityRole="timer">
                    {formatElapsed(recorder.elapsedMs)}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={recorder.stop} style={styles.send}>
                    <Text style={styles.sendLabel}>Stop</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a receipt photo"
                    disabled={busy}
                    onPress={() => setReceiptOpen(true)}
                    style={({ pressed }) => [styles.tool, pressed ? styles.jobPressed : null, busy ? styles.disabled : null]}
                  >
                    <Text style={styles.jobLabel}>Receipt</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Record a message"
                    disabled={busy}
                    onPress={() => void recorder.start()}
                    style={({ pressed }) => [styles.tool, pressed ? styles.jobPressed : null, busy ? styles.disabled : null]}
                  >
                    <Text style={styles.jobLabel}>Record</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                    disabled={!text.trim() || busy}
                    onPress={() => send(text, { fromComposer: true })}
                    style={({ pressed }) => [
                      styles.send,
                      pressed && text.trim() && !busy ? styles.sendPressed : null,
                      !text.trim() || busy ? styles.disabled : null,
                    ]}
                  >
                    <Text style={styles.sendLabel}>{busy ? "…" : "Send"}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={jobSheetOpen}
        title="Job"
        options={[
          { id: NO_JOB, label: "New job" },
          ...openJobs.map((row) => ({ id: row.id, label: row.title, detail: row.client?.name })),
        ]}
        currentId={job?.id ?? NO_JOB}
        status={jobsStatus}
        onClose={() => setJobSheetOpen(false)}
        onSelect={(id) => {
          const chosen = openJobs.find((row) => row.id === id);
          setJob(chosen ? { id: chosen.id, title: chosen.title } : null);
        }}
      />

      <PlanPickerSheet
        visible={pickerOpen}
        plans={plans}
        currentId={planId}
        loading={plansLoading}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => void selectPlan(id)}
        onNewPlan={() => {
          startNewPlan();
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.navy,
  },
  plansBtn: {
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
  },
  plansBtnLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  topSpacer: { width: 64 },
  brand: { color: colors.ink, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 20 },
  scrollCentered: { justifyContent: "center" },
  scrollEnd: { justifyContent: "flex-end" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },
  welcome: { alignItems: "center", gap: 10, paddingVertical: 12 },
  welcomeTitle: { color: colors.ink, fontSize: 24, fontWeight: "600", letterSpacing: -0.4, textAlign: "center" },
  welcomeBody: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 320 },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 },
  chip: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipPressed: { backgroundColor: colors.elevated, borderColor: colors.elevatedBorder },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  thread: { gap: 12 },
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  userBubble: {
    maxWidth: "85%",
    backgroundColor: colors.elevated,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  thinkingRow: { flexDirection: "row", alignItems: "center" },
  composerWrap: { gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: colors.paper },
  unsent: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tool: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timer: { color: colors.muted, fontSize: 14, fontVariant: ["tabular-nums"], marginLeft: "auto" },
  composer: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  input: {
    color: colors.ink,
    fontSize: 15,
    minHeight: 56,
    maxHeight: 140,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  row: { alignItems: "center", flexDirection: "row", gap: 6, paddingHorizontal: 2 },
  job: {
    flexShrink: 1,
    marginRight: "auto",
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jobPressed: { backgroundColor: colors.elevated, borderColor: colors.elevatedBorder },
  jobLabel: { color: colors.ink, fontSize: 13, fontWeight: "500" },
  send: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendPressed: { backgroundColor: colors.accent2 },
  sendLabel: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  disabled: { opacity: 0.45 },
});