import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";

export type SheetOption = { id: string; label: string; detail?: string | null };

/** A bottom sheet for picking one thing, such as a job. */
export function OptionSheet({
  visible,
  title,
  options,
  currentId,
  status,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  currentId: string | null;
  /** Shown under the list, e.g. while loading. */
  status?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {options.map((option) => {
            const active = option.id === currentId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onSelect(option.id);
                  onClose();
                }}
                style={({ pressed }) => [styles.row, active ? styles.rowActive : null, pressed ? styles.rowPressed : null]}
              >
                <Text style={[styles.label, active ? styles.labelActive : null]}>{option.label}</Text>
                {option.detail ? <Text style={styles.detail}>{option.detail}</Text> : null}
              </Pressable>
            );
          })}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 32,
    gap: 10,
  },
  title: { color: colors.ink, fontSize: 17, fontWeight: "600" },
  list: { flexGrow: 0 },
  row: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 4, gap: 2 },
  rowActive: { backgroundColor: colors.elevated },
  rowPressed: { backgroundColor: colors.card },
  label: { color: colors.muted, fontSize: 15 },
  labelActive: { color: colors.ink, fontWeight: "600" },
  detail: { color: colors.muted, fontSize: 12 },
  status: { color: colors.muted, fontSize: 13, paddingVertical: 8, paddingHorizontal: 12 },
});
