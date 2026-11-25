import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { groupPlansByJob, type PlanSummary } from "./plans";
import { colors } from "./theme";

export function PlanPickerSheet({
  visible,
  plans,
  currentId,
  loading,
  onClose,
  onSelect,
  onNewPlan,
}: {
  visible: boolean;
  plans: PlanSummary[];
  currentId: string | null;
  loading: boolean;
  onClose: () => void;
  onSelect: (planId: string) => void;
  onNewPlan: () => void;
}) {
  const groups = groupPlansByJob(plans);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close plans" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Saved plans</Text>
          <Pressable accessibilityRole="button" onPress={onNewPlan} style={styles.newBtn}>
            <Text style={styles.newLabel}>New</Text>
          </Pressable>
        </View>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : plans.length === 0 ? (
          <Text style={styles.muted}>No saved plans yet. Send a message to start one.</Text>
        ) : (
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {groups.map((group) => (
              <View key={group.jobTitle ?? "none"} style={styles.group}>
                <Text style={styles.groupTitle}>{group.jobTitle ?? "No job"}</Text>
                {group.plans.map((plan) => {
                  const active = plan.id === currentId;
                  return (
                    <Pressable
                      key={plan.id}
                      accessibilityRole="button"
                      onPress={() => {
                        onSelect(plan.id);
                        onClose();
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        active ? styles.rowActive : null,
                        pressed ? styles.rowPressed : null,
                      ]}
                    >
                      <Text style={[styles.rowLabel, active ? styles.rowLabelActive : null]} numberOfLines={2}>
                        {plan.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    maxHeight: "72%",
    backgroundColor: colors.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginTop: 10,
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: colors.ink, fontSize: 17, fontWeight: "600" },
  newBtn: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newLabel: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14, paddingVertical: 8 },
  list: { flexGrow: 0 },
  group: { marginBottom: 16 },
  groupTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  row: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  rowActive: { backgroundColor: colors.elevated },
  rowPressed: { backgroundColor: colors.card },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowLabelActive: { color: colors.ink, fontWeight: "600" },
});