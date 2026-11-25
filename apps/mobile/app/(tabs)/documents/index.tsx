import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { listDocuments, type DocumentListItem } from "../../../src/api";
import { getBearer } from "../../../src/session";
import { formatCad } from "../../../src/money";
import { DocumentListSkeleton } from "../../../src/skeletons";
import { EmptyState, Header, Notice, SecondaryButton, Screen, StatusPill } from "../../../src/ui";
import { colors } from "../../../src/theme";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "quote", label: "Quotes" },
  { id: "invoice", label: "Invoices" },
] as const;

export default function DocumentsScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [documents, setDocuments] = useState<DocumentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setError(null);
        try {
          const bearer = await getBearer();
          if (!bearer) {
            if (!cancelled) setDocuments([]);
            return;
          }
          const rows = await listDocuments(bearer, filter === "all" ? undefined : { type: filter });
          if (!cancelled) setDocuments(rows);
        } catch (err) {
          if (!cancelled) {
            setDocuments([]);
            setError(err instanceof Error ? err.message : "Could not load documents.");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [filter]),
  );

  const showSkeleton = documents === null;
  const showEmpty = documents !== null && documents.length === 0;

  return (
    <Screen>
      <Header title="Documents" subtitle="Quotes and invoices in one list." />
      <View style={styles.segmented} accessibilityRole="tablist">
        {FILTERS.map((item) => {
          const active = item.id === filter;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item.id)}
              style={({ pressed }) => [
                styles.segment,
                active ? styles.segmentActive : null,
                pressed && !active ? styles.segmentPressed : null,
              ]}
            >
              <Text style={[styles.segmentLabel, active ? styles.segmentLabelActive : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Notice>{error}</Notice> : null}
      {showSkeleton ? (
        <DocumentListSkeleton />
      ) : showEmpty ? (
        <EmptyState
          title={filter === "all" ? "No documents yet" : "No matching documents"}
          body={filter === "all" ? "Create a quote or invoice from a job on the web, or confirm one from Plan." : "Try another type."}
          action={
            filter === "all" ? undefined : <SecondaryButton label="Clear filters" onPress={() => setFilter("all")} />
          }
        />
      ) : (
        <View style={styles.list}>
          {documents.map((doc) => (
            <Pressable
              key={doc.id}
              accessibilityRole="link"
              onPress={() => router.push(`/documents/${doc.id}`)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.title}>
                  {doc.type === "quote" ? "Quote" : "Invoice"} {doc.number}
                </Text>
                <Text style={styles.subtitle}>{doc.client?.name ?? doc.job?.title ?? "—"}</Text>
                <StatusPill label={doc.status} />
              </View>
              <Text style={styles.amount}>{formatCad(doc.total)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 2,
  },
  segment: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  segmentActive: { backgroundColor: colors.elevated },
  segmentPressed: { backgroundColor: "rgba(39, 39, 43, 0.55)" },
  segmentLabel: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  segmentLabelActive: { color: colors.ink, fontWeight: "600" },
  list: { gap: 10 },
  row: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
  },
  rowPressed: { backgroundColor: colors.elevated },
  rowCopy: { flex: 1, gap: 6 },
  title: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  subtitle: { color: colors.muted, fontSize: 13 },
  amount: { color: colors.muted, fontSize: 14, fontVariant: ["tabular-nums"] },
});