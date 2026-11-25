import { StyleSheet, View } from "react-native";
import { colors } from "./theme";

function Block({ height, width = "100%" }: { height: number; width?: number | `${number}%` }) {
  return <View style={[styles.block, { height, width }]} />;
}

export function JobListSkeleton() {
  return (
    <View style={styles.stack} accessibilityLabel="Loading jobs" accessibilityState={{ busy: true }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={styles.rowCard}>
          <Block height={16} width="55%" />
          <Block height={12} width="40%" />
        </View>
      ))}
    </View>
  );
}

export function JobDetailSkeleton() {
  return (
    <View style={styles.stack} accessibilityLabel="Loading job details" accessibilityState={{ busy: true }}>
      <View style={styles.row}>
        <Block height={40} width="48%" />
        <Block height={40} width="48%" />
      </View>
      <View style={styles.card}>
        <Block height={14} width="30%" />
        <Block height={40} />
        <Block height={40} />
        <Block height={72} />
      </View>
      <View style={styles.card}>
        <Block height={14} width="40%" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Block key={index} height={44} />
        ))}
      </View>
    </View>
  );
}

export function DocumentListSkeleton() {
  return (
    <View style={styles.stack} accessibilityLabel="Loading documents" accessibilityState={{ busy: true }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={index} style={styles.rowCard}>
          <Block height={16} width="35%" />
          <Block height={12} width="50%" />
          <Block height={20} width="28%" />
        </View>
      ))}
    </View>
  );
}

export function DocumentDetailSkeleton() {
  return (
    <View style={styles.stack} accessibilityLabel="Loading document" accessibilityState={{ busy: true }}>
      <View style={styles.row}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Block key={index} height={36} width="30%" />
        ))}
      </View>
      <View style={styles.card}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles.metaRow}>
            <Block height={10} width="24%" />
            <Block height={14} width="50%" />
          </View>
        ))}
      </View>
      <View style={styles.card}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Block key={index} height={48} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  block: { borderRadius: 8, backgroundColor: colors.elevated },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rowCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});