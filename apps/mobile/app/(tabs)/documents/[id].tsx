import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { fetchDocument, type DocumentDetail } from "../../../src/api";
import { getBearer } from "../../../src/session";
import { formatCad } from "../../../src/money";
import { DocumentDetailSkeleton } from "../../../src/skeletons";
import { Card, Notice, StatusPill } from "../../../src/ui";
import { colors } from "../../../src/theme";

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = typeof id === "string" ? id : "";
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!documentId) return;
      let cancelled = false;
      setDocument(null);
      setError(null);
      (async () => {
        try {
          const bearer = await getBearer();
          if (!bearer) {
            if (!cancelled) setError("Sign in on the Settings tab first.");
            return;
          }
          const doc = await fetchDocument(bearer, documentId);
          if (!cancelled) setDocument(doc);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load document.");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [documentId]),
  );

  if (!documentId) {
    return <Notice>Missing document.</Notice>;
  }

  if (!document) {
    return (
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {error ? <Notice>{error}</Notice> : null}
        {!error ? <DocumentDetailSkeleton /> : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {error ? <Notice>{error}</Notice> : null}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{document.type === "quote" ? "Quote" : "Invoice"}</Text>
          <Text style={styles.title}>{document.number}</Text>
        </View>
        <StatusPill label={document.status} />
      </View>
      <Card>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Client</Text>
          <Text style={styles.metaValue}>{document.client?.name ?? "—"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Job</Text>
          {document.job ? (
            <Pressable accessibilityRole="link" onPress={() => router.push(`/jobs/${document.job!.id}`)}>
              <Text style={styles.jobLink}>{document.job.title}</Text>
            </Pressable>
          ) : (
            <Text style={styles.metaValue}>—</Text>
          )}
        </View>
      </Card>
      <Card>
        {document.lines.map((line, index) => (
          <View key={line.id} style={[styles.lineRow, index > 0 ? styles.lineBorder : null]}>
            <View style={styles.lineCopy}>
              <Text style={styles.lineDesc}>{line.description}</Text>
              <Text style={styles.lineMeta}>
                {line.quantity} {line.unit} × {formatCad(line.unitPrice)}
              </Text>
            </View>
            <Text style={styles.lineAmount}>{formatCad(line.lineTotal)}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCad(document.total)}</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaLabel: { color: colors.muted, fontSize: 12, fontWeight: "500", width: 52 },
  metaValue: { color: colors.ink, fontSize: 14, flex: 1 },
  jobLink: { color: colors.accent, fontSize: 14, fontWeight: "500" },
  lineRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingVertical: 8 },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  lineCopy: { flex: 1, gap: 2 },
  lineDesc: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  lineMeta: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  lineAmount: { color: colors.ink, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  totals: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  totalValue: { color: colors.ink, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
});