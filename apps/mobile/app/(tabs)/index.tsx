import { type ComponentRef, useCallback, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  confirmCapture,
  fetchPlanThread,
  listPlans,
  sendTextCapture,
  type ConfirmResult,
  type TextCaptureResult,
} from "../../src/api";
import { PlanPickerSheet } from "../../src/plan-picker-sheet";
import { PlanProposalCard } from "../../src/plan-proposal-card";
import { PLAN_NEW, type PlanSummary, type PlanThreadMessage } from "../../src/plans";
import { getBearer } from "../../src/session";
import { GhostButton, Notice, StatusPill } from "../../src/ui";
import { colors } from "../../src/theme";

const STARTER_PROMPTS = [
  "What unbilled work do I have?",
  "Log 2 hours of labour and $150 in materials",
  "Quote a water heater replacement for a new client",
];

function confirmLabel(result: ConfirmResult): string {
  if (result.kind === "done") return result.message;
  if (result.kind === "document") return "Document saved";
  if (result.kind === "job") return "Job created";
  return `Logged on ${result.jobIds.length} job${result.jobIds.length === 1 ? "" : "s"}`;
}

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
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TextCaptureResult | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmResult | null>(null);

  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const submittingRef = useRef(false);

  const syncThread = useCallback(async (id: string) => {
    const bearer = await getBearer();
    if (!bearer) return;
    const thread = await fetchPlanThread(bearer, id);
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

  const selectPlan = useCallback(
    async (id: string) => {
      setError(null);
      setPreview(null);
      setConfirmed(null);
      setSentText(null);
      setThreadLoading(true);
      try {
        await syncThread(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this plan.");
        setThreadMessages([]);
        setPlanId(null);
      } finally {
        setThreadLoading(false);
      }
    },
    [syncThread],
  );

  const startNewPlan = useCallback(() => {
    setPlanId(null);
    setThreadMessages([]);
    setPreview(null);
    setConfirmed(null);
    setSentText(null);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    setText("");
    setBusy(true);
    setError(null);
    setConfirmed(null);
    setPreview(null);
    setSentText(trimmed);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setSentText(null);
        setText((current) => current || trimmed);
        setError("Sign in on the Settings tab first.");
        return;
      }
      const result = await sendTextCapture(bearer, trimmed, { planId: planId ?? PLAN_NEW });
      setPreview(result);
      if (result.planId && result.planId !== planId) {
        setPlanId(result.planId);
      }
      if (result.planId) {
        await syncThread(result.planId);
        setSentText(null);
        setPreview(null);
      } else if (result.status === "failed") {
        setText((current) => current || trimmed);
        setError("We could not read that message.");
      }
    } catch (err) {
      setSentText(null);
      setText((current) => current || trimmed);
      setError(err instanceof Error ? err.message : "Send failed.");
      setPreview(null);
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }, [planId, syncThread, text]);

  const onConfirm = useCallback(
    async (captureId: string, canConfirm: boolean) => {
      if (!canConfirm) return;
      setBusy(true);
      setError(null);
      try {
        const bearer = await getBearer();
        if (!bearer) {
          setError("Sign in on the Settings tab first.");
          return;
        }
        const result = await confirmCapture(bearer, captureId);
        setConfirmed(result);
        if (planId) await syncThread(planId);
        if (result.kind === "document") router.push(`/documents/${result.documentId}`);
        if (result.kind === "job") router.push(`/jobs/${result.jobId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Confirm failed.");
      } finally {
        setBusy(false);
      }
    },
    [planId, syncThread],
  );

  const hasThread = threadMessages.length > 0;
  const hasPending = Boolean(sentText || preview || error);
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
                  ) : message.preview ? (
                    <PlanProposalCard
                      preview={message.preview}
                      busy={busy}
                      confirmedLabel={
                        message.outcome === "confirmed"
                          ? "Saved"
                          : message.outcome === "cancelled"
                            ? "Cancelled"
                            : message.outcome === "failed"
                              ? "Failed"
                              : null
                      }
                      onConfirm={() => void onConfirm(message.captureId!, message.preview!.canConfirm)}
                    />
                  ) : (
                    <View style={styles.replyBox}>
                      <Text style={styles.replyText}>{message.body}</Text>
                    </View>
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

              {busy && !preview ? (
                <View style={styles.thinkingRow}>
                  <StatusPill label="Reading your message…" tone="accent" />
                </View>
              ) : null}

              {error ? <Notice>{error}</Notice> : null}

              {preview?.reply && !preview.preview ? (
                <View style={styles.replyBox}>
                  <Text style={styles.replyText}>{preview.reply}</Text>
                </View>
              ) : null}

              {preview?.preview && !preview.planId ? (
                <PlanProposalCard
                  preview={preview.preview}
                  busy={busy}
                  confirmedLabel={confirmed ? confirmLabel(confirmed) : null}
                  onCancel={() => {
                    setPreview(null);
                    setSentText(null);
                  }}
                  onConfirm={() => void onConfirm(preview.captureId, preview.preview!.canConfirm)}
                />
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
                onPress={() => void submit()}
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
  replyBox: { paddingHorizontal: 2, paddingVertical: 4 },
  replyText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
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