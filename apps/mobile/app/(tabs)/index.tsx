import { type ComponentRef, useCallback, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { confirmCapture, sendTextCapture, type ConfirmResult, type TextCaptureResult } from "../../src/api";
import { getBearer } from "../../src/session";
import { GhostButton, Notice, PrimaryButton, StatusPill } from "../../src/ui";
import { colors } from "../../src/theme";

const STARTER_PROMPTS = [
  "What unbilled work do I have?",
  "Log 2 hours of labour and $150 in materials",
  "Quote a water heater replacement for a new client",
];

function formatCad(amount: number) {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `$${rounded.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [sentText, setSentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TextCaptureResult | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmResult | null>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const submittingRef = useRef(false);

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
      const result = await sendTextCapture(bearer, trimmed);
      setPreview(result);
      if (result.status === "failed") {
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
  }, [text]);

  async function onConfirm() {
    if (!preview?.captureId || !preview.preview?.canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setError("Sign in on the Settings tab first.");
        return;
      }
      const result = await confirmCapture(bearer, preview.captureId);
      setConfirmed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed.");
    } finally {
      setBusy(false);
    }
  }

  function resetPreview() {
    setPreview(null);
    setConfirmed(null);
    setSentText(null);
    setError(null);
  }

  const linesSubtotal = useMemo(() => {
    const lines = preview?.preview?.lines ?? [];
    if (lines.length === 0) return null;
    if (lines.some((line) => line.unitPrice == null || !Number.isFinite(line.quantity))) return null;
    return lines.reduce(
      (sum, line) => sum + Math.round((line.quantity * (line.unitPrice ?? 0) + Number.EPSILON) * 100) / 100,
      0,
    );
  }, [preview]);

  const isEmpty = !sentText && !preview && !error;
  const alerts = [...(preview?.preview?.blockers ?? []), ...(preview?.preview?.warnings ?? [])];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.topBar}>
          <Text style={styles.brand}>Trades Planner</Text>
          {!isEmpty ? <GhostButton label="New plan" onPress={resetPreview} /> : null}
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

              {preview?.preview ? (
                <View style={styles.proposalCard}>
                  <View style={styles.proposalHead}>
                    <View style={styles.proposalHeadCopy}>
                      <Text style={styles.eyebrow}>Review before saving</Text>
                      <Text style={styles.previewTitle}>{preview.preview.title}</Text>
                    </View>
                    {linesSubtotal != null ? (
                      <View style={styles.subtotalBadge}>
                        <Text style={styles.subtotalText}>{formatCad(linesSubtotal)}</Text>
                      </View>
                    ) : null}
                  </View>

                  {preview.preview.jobTitle || preview.preview.clientName ? (
                    <View style={styles.metaBox}>
                      {preview.preview.jobTitle ? (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Job</Text>
                          <Text style={styles.metaValue}>{preview.preview.jobTitle}</Text>
                        </View>
                      ) : null}
                      {preview.preview.clientName ? (
                        <View style={styles.metaRow}>
                          <Text style={styles.metaLabel}>Client</Text>
                          <Text style={styles.metaValue}>{preview.preview.clientName}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {preview.preview.lines.length > 0 ? (
                    <View style={styles.linesBox}>
                      {preview.preview.lines.map((line, index) => {
                        const lineAmount =
                          line.unitPrice != null ? formatCad(line.quantity * line.unitPrice) : null;
                        return (
                          <View
                            key={index}
                            style={[styles.lineRow, index > 0 ? styles.lineRowBorder : null]}
                          >
                            <View style={styles.lineCopy}>
                              <Text style={styles.lineDesc}>{line.description}</Text>
                              <Text style={styles.lineMeta}>
                                {line.quantity} {line.unit}
                                {line.unitPrice != null ? ` × ${formatCad(line.unitPrice)}` : ""}
                              </Text>
                              {line.note ? <Text style={styles.lineNote}>{line.note}</Text> : null}
                            </View>
                            {lineAmount ? <Text style={styles.lineAmount}>{lineAmount}</Text> : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}

                  {alerts.length > 0 ? (
                    <View style={styles.alertBox}>
                      {alerts.map((message, index) => (
                        <Text key={index} style={styles.alertText}>
                          {message}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.proposalFooter}>
                    {confirmed ? (
                      <StatusPill
                        tone="ok"
                        label={
                          confirmed.kind === "document"
                            ? "Document saved"
                            : confirmed.kind === "job"
                              ? "Job created"
                              : `Logged on ${confirmed.jobIds.length} job${confirmed.jobIds.length === 1 ? "" : "s"}`
                        }
                      />
                    ) : (
                      <View style={styles.actions}>
                        <GhostButton label="Cancel" disabled={busy} onPress={resetPreview} />
                        <PrimaryButton
                          size="sm"
                          fullWidth={false}
                          label={busy ? "Confirming…" : "Confirm"}
                          disabled={busy || !preview.preview.canConfirm}
                          onPress={() => void onConfirm()}
                        />
                      </View>
                    )}
                  </View>
                </View>
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
  brand: { color: colors.ink, fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 20 },
  scrollCentered: { justifyContent: "center" },
  scrollEnd: { justifyContent: "flex-end" },
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
  proposalCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  proposalHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  proposalHeadCopy: { flex: 1, gap: 3 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  previewTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  subtotalBadge: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  subtotalText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  metaBox: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  metaRow: { flexDirection: "row", gap: 12 },
  metaLabel: { color: colors.muted, fontSize: 12, fontWeight: "500", width: 52 },
  metaValue: { color: colors.ink, fontSize: 13, flex: 1 },
  linesBox: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  lineRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 11 },
  lineRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  lineCopy: { flex: 1, gap: 2 },
  lineDesc: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  lineMeta: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  lineNote: { color: colors.danger, fontSize: 12, marginTop: 2 },
  lineAmount: { color: colors.ink, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  alertBox: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  alertText: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  proposalFooter: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
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
