import { useRef, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { createShareLink, invoiceQuote, setDocumentStatus, type DocumentDetail, type DocumentStatusChange } from "./api";
import { getBearer } from "./session";
import { Card, GhostButton, Notice, PrimaryButton, SecondaryButton } from "./ui";
import { colors } from "./theme";

/** Answers that can't be taken back, so they ask twice. */
const FINAL_CHANGES: Partial<Record<DocumentStatusChange, string>> = {
  approved: "Mark approved",
  declined: "Mark declined",
  paid: "Mark paid",
};

export function DocumentActions({ document, onChanged }: { document: DocumentDetail; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<DocumentStatusChange | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const runningRef = useRef(false);

  async function run(work: (bearer: string) => Promise<void>) {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setError("Sign in on the Settings tab first.");
        return;
      }
      await work(bearer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }

  function change(status: DocumentStatusChange) {
    void run(async (bearer) => {
      try {
        await setDocumentStatus(bearer, document.id, status);
      } finally {
        // Reload either way: a refusal usually means the client already answered from the link.
        setAsking(null);
        await onChanged();
      }
    });
  }

  function share() {
    void run(async (bearer) => {
      const url = await createShareLink(bearer, document.id);
      setLink(url);
      const label = `${document.type === "quote" ? "Quote" : "Invoice"} ${document.number}`;
      // iOS shares a url on its own; Android only reads the message. The link stays on screen if the sheet can't open.
      await Share.share({ title: label, message: `${label}: ${url}` }).catch(() => undefined);
    });
  }

  function createInvoice() {
    void run(async (bearer) => {
      const invoiceId = await invoiceQuote(bearer, document.id);
      await onChanged();
      router.push(`/documents/${invoiceId}`);
    });
  }

  const has = (action: string) => document.actions.includes(action);
  const hasAny =
    document.canShare || has("mark-sent") || has("approve") || has("create-invoice") || has("mark-paid");
  if (!hasAny && !error) return null;

  return (
    <Card>
      {error ? <Notice>{error}</Notice> : null}
      {asking ? (
        <View style={styles.stack}>
          <Text style={styles.question}>
            {FINAL_CHANGES[asking]}: {document.number}? This can’t be changed back.
          </Text>
          <PrimaryButton label={FINAL_CHANGES[asking]!} disabled={busy} onPress={() => change(asking)} />
          <GhostButton label="Not now" size="md" disabled={busy} onPress={() => setAsking(null)} />
        </View>
      ) : (
        <View style={styles.stack}>
          {document.canShare ? <PrimaryButton label="Share link" disabled={busy} onPress={share} /> : null}
          {has("mark-sent") ? (
            <SecondaryButton label="Mark sent" fullWidth disabled={busy} onPress={() => change("sent")} />
          ) : null}
          {has("approve") ? (
            <SecondaryButton label="Mark approved" fullWidth disabled={busy} onPress={() => setAsking("approved")} />
          ) : null}
          {has("decline") ? (
            <SecondaryButton label="Mark declined" fullWidth disabled={busy} onPress={() => setAsking("declined")} />
          ) : null}
          {has("mark-paid") ? (
            <SecondaryButton label="Mark paid" fullWidth disabled={busy} onPress={() => setAsking("paid")} />
          ) : null}
          {has("create-invoice") ? (
            document.invoiceId ? (
              <PrimaryButton label="Open invoice" disabled={busy} onPress={() => router.push(`/documents/${document.invoiceId}`)} />
            ) : (
              <PrimaryButton label="Create invoice" disabled={busy} onPress={createInvoice} />
            )
          ) : null}
        </View>
      )}
      {link ? (
        <Text selectable style={styles.link}>
          {link}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8, alignItems: "stretch" },
  question: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  link: { color: colors.muted, fontSize: 12 },
});
