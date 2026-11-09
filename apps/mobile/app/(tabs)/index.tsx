import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { confirmCapture, sendTextCapture, type ConfirmResult, type TextCaptureResult } from "../../src/api";
import { getBearer } from "../../src/session";
import { GhostButton, Notice, PrimaryButton, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TextCaptureResult | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmResult | null>(null);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setConfirmed(null);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setError("Sign in on the Settings tab first.");
        return;
      }
      const result = await sendTextCapture(bearer, trimmed);
      setPreview(result);
      if (result.status === "failed") setError("We could not read that message.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
      setPreview(null);
    } finally {
      setBusy(false);
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
    setError(null);
  }

  return (
    <Screen>
      <View style={styles.thread}>
        {error ? <Notice>{error}</Notice> : null}
        {preview?.preview ? (
          <View style={styles.card}>
            <Text style={styles.previewTitle}>{preview.preview.title}</Text>
            {preview.preview.lines.map((line, index) => (
              <Text key={index} style={styles.line}>
                {line.quantity} {line.unit} · {line.description}
                {line.unitPrice != null ? ` · $${line.unitPrice}` : ""}
              </Text>
            ))}
            {confirmed ? (
              <Text style={styles.done}>
                {confirmed.kind === "document"
                  ? `Document ${confirmed.documentId}`
                  : confirmed.kind === "job"
                    ? `Job ${confirmed.jobId}`
                    : `Logged on ${confirmed.jobIds.length} job(s)`}
              </Text>
            ) : (
              <View style={styles.actions}>
                <GhostButton label="Cancel" onPress={resetPreview} />
                <PrimaryButton
                  label={busy ? "Working…" : "Confirm"}
                  disabled={busy || !preview.preview.canConfirm}
                  onPress={() => void onConfirm()}
                />
              </View>
            )}
          </View>
        ) : null}
      </View>
      <View style={styles.composer}>
        <TextInput
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
            style={styles.job}
          >
            <Text style={styles.jobLabel}>New job</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!text.trim() || busy}
            onPress={() => void submit()}
            style={[styles.send, !text.trim() || busy ? styles.disabled : null]}
          >
            <Text style={styles.sendLabel}>{busy ? "…" : "Send"}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thread: { flexGrow: 1, justifyContent: "flex-end", minHeight: 160, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  previewTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  line: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  done: { color: colors.accent, fontSize: 14, fontWeight: "600", marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 8 },
  composer: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },
  input: {
    color: colors.ink,
    fontSize: 16,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  job: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jobLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  send: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendLabel: { color: "#141414", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.55 },
});
