import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { listJobs, type JobListItem } from "../../../src/api";
import { getBearer } from "../../../src/session";
import { formatCad } from "../../../src/money";
import { JobListSkeleton } from "../../../src/skeletons";
import { EmptyState, Header, Notice, PrimaryButton, Screen, StatusPill } from "../../../src/ui";
import { colors } from "../../../src/theme";

export default function JobsScreen() {
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setError(null);
        try {
          const bearer = await getBearer();
          if (!bearer) {
            if (!cancelled) setJobs([]);
            return;
          }
          const rows = await listJobs(bearer);
          if (!cancelled) setJobs(rows);
        } catch (err) {
          if (!cancelled) {
            setJobs([]);
            setError(err instanceof Error ? err.message : "Could not load jobs.");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen>
      <Header title="Jobs" subtitle="Active work and quoted jobs." />
      {error ? <Notice>{error}</Notice> : null}
      {jobs === null ? (
        <JobListSkeleton />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          body="Describe work on the Plan tab, or add a job here."
          action={<PrimaryButton label="New job" fullWidth={false} onPress={() => router.push("/jobs/new")} />}
        />
      ) : (
        <View style={styles.list}>
          {jobs.map((job) => (
            <Pressable
              key={job.id}
              accessibilityRole="link"
              onPress={() => router.push(`/jobs/${job.id}`)}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.title}>{job.title}</Text>
                <Text style={styles.subtitle}>{job.client?.name ?? "No client"}</Text>
                <StatusPill label={job.status} />
              </View>
              <Text style={styles.amount}>{formatCad(job.unbilledTotal)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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