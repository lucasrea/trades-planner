import { type ComponentRef, useCallback, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  cancelCapture,
  confirmCapture,
  fetchPlanThread,
  listPlans,
  sendTextCapture,
  updateCaptureLines,
  type PlanLineEdit,
} from "../../src/api";
import { confirmedScreen } from "../../src/links";
import { PlanPickerSheet } from "../../src/plan-picker-sheet";
import { PlanReply, type CardAction } from "../../src/plan-reply";
import { localTurn, PLAN_NEW, type PlanSummary, type PlanThreadMessage } from "../../src/plans";
import { getBearer } from "../../src/session";
import { GhostButton, Notice, StatusPill } from "../../src/ui";
import { colors } from "../../src/theme";

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

  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  /** One request at a time: a send or a card action. */
  const inFlightRef = useRef(false);
  /** The plan on screen, so a slow answer for another plan is not drawn over it. */
  const openPlanRef = useRef<string | null>(null);

  const syncThread = useCallback(async (id: string) => {
    const bearer = await getBearer();
    if (!bearer) return;
    const thread = await fetchPlanThread(bearer, id);
    if (openPlanRef.current !== id) return;
    setPlanId(thread.id);
    setThreadMessages(thread.messages);
  }, []);

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

  const clearNotes = useCallback(() => {
    setError(null);
    setNotice(null);
    setCardError(null);
    setSentText(null);
  }, []);

  const selectPlan = useCallback(
    async (id: string) => {
      clearNotes();
      openPlanRef.current = id;
      setThreadLoading(true);
      try {
        await syncThread(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this plan.");
        setThreadMessages([]);
        setPlanId(null);
        openPlanRef.current = null;
      } finally {
        setThreadLoading(false);
      }
    },
    [clearNotes, syncThread],
  );

  const startNewPlan = useCallback(() => {
    clearNotes();
    openPlanRef.current = null;
    setPlanId(null);
    setThreadMessages([]);
  }, [clearNotes]);

  const send = useCallback(
    async (message: string, options?: { jobId?: string | null; fromComposer?: boolean }) => {
      const trimmed = message.trim();
      if (!trimmed || inFlightRef.current) return;
      inFlightRef.current = true;
      if (options?.fromComposer) setText("");
      setBusy(true);
      clearNotes();
      setSentText(trimmed);
      const startedOn = openPlanRef.current;
      const restore = () => {
        setSentText(null);
        if (options?.fromComposer) setText((current) => current || trimmed);
      };
      try {
        const bearer = await getBearer();
        if (!bearer) {
          restore();
          setError("Sign in on the Settings tab first.");
          return;
        }
        const result = await sendTextCapture(bearer, trimmed, {
          planId: planId ?? PLAN_NEW,
          jobId: options?.jobId ?? undefined,
        });
        if (openPlanRef.current !== startedOn) return;
        let saved = false;
        if (result.planId) {
          openPlanRef.current = result.planId;
          setPlanId(result.planId);
          // The message went through. If only the reload fails, show the answer from this response.
          saved = await syncThread(result.planId).then(
            () => true,
            () => false,
          );
        }
        if (!saved) setThreadMessages((rows) => [...rows, ...localTurn(trimmed, result)]);
        setSentText(null);
        if (result.status === "failed" && !result.planId) {
          restore();
          setError("We could not read that message.");
        }
      } catch (err) {
        restore();
        setError(err instanceof Error ? err.message : "Send failed.");
      } finally {
        setBusy(false);
        inFlightRef.current = false;
      }
    },
    [clearNotes, planId, syncThread],
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
  const hasPending = Boolean(sentText || error);
  const isEmpty = !hasThread && !hasPending && !threadLoading;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => void openPlans()} style={styles.plansBtn}>
            <Text style={styles.plansBtnLabel}>Plans</Text>
          </Pressable>
          <Text style={styles.brand}>Trades Planner</Text>
          {!isEmpty ? <GhostButton label="New plan" onPress={startNewPlan} /> : <View style={styles.topSpacer} />}
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
                      disabled={busy}
                      error={cardError && cardError.captureId === message.captureId ? cardError.message : null}
                      onConfirm={(captureId) => void onConfirm(captureId)}
                      onCancel={onCancel}
                      onSaveLines={onSaveLines}
                      onChoose={
                        message.id === lastMessageId
                          ? (label, jobId) => void send(label, { jobId })
                          : undefined
                      }
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

              {busy && sentText ? (
                <View style={styles.thinkingRow}>
                  <StatusPill label="Reading your message…" tone="accent" />
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
                onPress={() => setError("Choosing a job on the phone isn’t connected yet.")}
                style={({ pressed }) => [styles.job, pressed ? styles.jobPressed : null]}
              >
                <Text style={styles.jobLabel}>New job ▾</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                disabled={!text.trim() || busy}
                onPress={() => void send(text, { fromComposer: true })}
                style={({ pressed }) => [
                  styles.send,
                  pressed && text.trim() && !busy ? styles.sendPressed : null,
                  !text.trim() || busy ? styles.disabled : null,
                ]}
              >
                <Text style={styles.sendLabel}>{busy ? "…" : "Send"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

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
  composerWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, backgroundColor: colors.paper },
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
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 2 },
  job: {
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