import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { fetchJobSummary, fetchJobWorkspace, type JobSummary, type JobWorkspace } from "../../../src/api";
import { getBearer } from "../../../src/session";
import { formatCad } from "../../../src/money";
import { JobDetailSkeleton } from "../../../src/skeletons";
import { Card, Notice, StatusPill } from "../../../src/ui";
import { colors } from "../../../src/theme";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = typeof id === "string" ? id : "";
  const [job, setJob] = useState<JobSummary | null>(null);
  const [workspace, setWorkspace] = useState<JobWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!jobId) return;
      let cancelled = false;
      setJob(null);
      setWorkspace(null);
      setError(null);
      (async () => {
        try {
          const bearer = await getBearer();
          if (!bearer) {
            if (!cancelled) setError("Sign in on the Settings tab first.");
            return;
          }
          const summaryPromise = fetchJobSummary(bearer, jobId);
          const workspacePromise = fetchJobWorkspace(bearer, jobId);
          const summary = await summaryPromise;
          if (cancelled) return;
          setJob(summary);
          const body = await workspacePromise;
          if (cancelled) return;
          setWorkspace(body);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load job.");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [jobId]),
  );

  if (!jobId) {
    return <Notice>Missing job.</Notice>;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {error ? <Notice>{error}</Notice> : null}
      {job ? (
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.subtitle}>{job.client?.name ?? "No client"}</Text>
          </View>
          <StatusPill label={job.status} />
        </View>
      ) : (
        <View style={styles.headerSkeleton}>
          <JobDetailSkeleton />
        </View>
      )}
      {job && !workspace ? <JobDetailSkeleton /> : null}
      {job && workspace ? (
        <View style={styles.body}>
          <Card>
            <Text style={styles.sectionTitle}>Documents</Text>
            {workspace.documents.length === 0 ? (
              <Text style={styles.muted}>None yet.</Text>
            ) : (
              workspace.documents.map((doc) => (
                <Pressable
                  key={doc.id}
                  accessibilityRole="link"
                  onPress={() => router.push(`/documents/${doc.id}`)}
                  style={({ pressed }) => [styles.docRow, pressed ? styles.docRowPressed : null]}
                >
                  <View style={styles.docCopy}>
                    <Text style={styles.docTitle}>
                      {doc.type === "quote" ? "Quote" : "Invoice"} {doc.number}
                    </Text>
                    <StatusPill label={doc.status} />
                  </View>
                  <Text style={styles.docAmount}>{formatCad(doc.total)}</Text>
                </Pressable>
              ))
            )}
          </Card>
          <Card>
            <Text style={styles.sectionTitle}>Tracked lines</Text>
            {workspace.tracked.length === 0 ? (
              <Text style={styles.muted}>Nothing unbilled on this job.</Text>
            ) : (
              workspace.tracked.map((line) => (
                <View key={line.id} style={styles.lineRow}>
                  <View style={styles.lineCopy}>
                    <Text style={styles.lineDesc}>{line.description}</Text>
                    <Text style={styles.lineMeta}>
                      {line.quantity} {line.unit} × {formatCad(line.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.lineAmount}>{formatCad(line.lineTotal)}</Text>
                </View>
              ))
            )}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "600", letterSpacing: -0.3 },
  subtitle: { color: colors.muted, fontSize: 14 },
  headerSkeleton: { marginTop: -8 },
  body: { gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  docRowPressed: { opacity: 0.85 },
  docCopy: { flex: 1, gap: 6 },
  docTitle: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  docAmount: { color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"] },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  lineCopy: { flex: 1, gap: 2 },
  lineDesc: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  lineMeta: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  lineAmount: { color: colors.ink, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
});