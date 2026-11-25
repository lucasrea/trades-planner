import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { EmptyState, Header, PrimaryButton, SecondaryButton, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "quote", label: "Quotes" },
  { id: "invoice", label: "Invoices" },
] as const;

export default function DocumentsScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const filtered = filter !== "all";

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
      {filtered ? (
        <EmptyState
          title="No matching documents"
          body="Try another type or status."
          action={<SecondaryButton label="Clear filters" onPress={() => setFilter("all")} />}
        />
      ) : (
        <EmptyState
          title="Documents aren’t loaded"
          body="Sign-in on the phone isn’t connected yet, so this list stays empty."
          action={<PrimaryButton label="Go to jobs" fullWidth={false} onPress={() => router.push("/jobs")} />}
        />
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
  segment: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  segmentActive: { backgroundColor: colors.elevated },
  segmentPressed: { backgroundColor: "rgba(39, 39, 43, 0.55)" },
  segmentLabel: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  segmentLabelActive: { color: colors.ink, fontWeight: "600" },
});
