import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { EmptyState, Header, PrimaryButton, Screen } from "../../src/ui";
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
      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = item.id === filter;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, active ? styles.filterOn : null]}
            >
              <Text style={[styles.filterLabel, active ? styles.filterLabelOn : null]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {filtered ? (
        <EmptyState
          title="No matching documents"
          body="Try another type or status."
          action={<PrimaryButton label="Clear filters" onPress={() => setFilter("all")} />}
        />
      ) : (
        <EmptyState
          title="No documents yet"
          body="Quotes and invoices are created from a job. Open a job to start a draft."
          action={<PrimaryButton label="Go to jobs" onPress={() => router.push("/jobs")} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterLabel: { color: colors.ink, fontSize: 14 },
  filterLabelOn: { color: "#1a100c", fontWeight: "600" },
});
