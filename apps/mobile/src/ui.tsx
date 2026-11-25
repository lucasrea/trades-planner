import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";

export function Screen({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  size = "md",
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: "md" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnBase,
        size === "sm" ? styles.btnSm : styles.btnMd,
        fullWidth ? styles.fullWidth : styles.fitWidth,
        styles.primary,
        pressed && !disabled ? styles.primaryPressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.primaryLabel, size === "sm" ? styles.labelSm : null]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  size = "md",
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: "md" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnBase,
        size === "sm" ? styles.btnSm : styles.btnMd,
        fullWidth ? styles.fullWidth : styles.fitWidth,
        styles.secondary,
        pressed && !disabled ? styles.secondaryPressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.secondaryLabel, size === "sm" ? styles.labelSm : null]}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  disabled,
  size = "sm",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnBase,
        size === "sm" ? styles.btnSm : styles.btnMd,
        styles.fitWidth,
        styles.ghost,
        pressed && !disabled ? styles.ghostPressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.ghostLabel, size === "sm" ? styles.labelSm : null]}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({
  label,
  onPress,
  disabled,
  size = "sm",
  fullWidth = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: "md" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btnBase,
        size === "sm" ? styles.btnSm : styles.btnMd,
        fullWidth ? styles.fullWidth : styles.fitWidth,
        styles.danger,
        pressed && !disabled ? styles.dangerPressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.dangerLabel, size === "sm" ? styles.labelSm : null]}>{label}</Text>
    </Pressable>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "ok" | "danger";
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === "accent"
          ? styles.pillAccent
          : tone === "ok"
            ? styles.pillOk
            : tone === "danger"
              ? styles.pillDanger
              : styles.pillNeutral,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === "accent"
            ? styles.pillTextAccent
            : tone === "ok"
              ? styles.pillTextOk
              : tone === "danger"
                ? styles.pillTextDanger
                : styles.pillTextNeutral,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
        {action ? <View style={styles.emptyAction}>{action}</View> : null}
      </View>
    </Card>
  );
}

export function Notice({
  children,
  tone = "danger",
}: {
  children: string;
  tone?: "danger" | "ok";
}) {
  return (
    <View style={[styles.noticeBox, tone === "ok" ? styles.noticeBoxOk : styles.noticeBoxDanger]}>
      <Text style={[styles.noticeText, tone === "ok" ? styles.noticeTextOk : styles.noticeTextDanger]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 32, gap: 16 },
  header: { gap: 4 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { color: colors.ink, fontSize: 26, fontWeight: "600", letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  btnBase: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  btnMd: { minHeight: 44, paddingHorizontal: 18, paddingVertical: 11 },
  btnSm: { minHeight: 36, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10 },
  fullWidth: { alignSelf: "stretch" },
  fitWidth: { alignSelf: "flex-start" },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  primaryPressed: { backgroundColor: colors.accent2, borderColor: colors.accent2 },
  primaryLabel: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  secondary: { backgroundColor: colors.elevated, borderColor: colors.elevatedBorder },
  secondaryPressed: { backgroundColor: "#323238", borderColor: "#45454e" },
  secondaryLabel: { color: colors.ink, fontSize: 15, fontWeight: "500" },
  ghost: { backgroundColor: "transparent", borderColor: colors.line },
  ghostPressed: { backgroundColor: colors.elevated, borderColor: colors.elevatedBorder },
  ghostLabel: { color: colors.ink, fontSize: 15, fontWeight: "500" },
  danger: { backgroundColor: "transparent", borderColor: colors.dangerBorder },
  dangerPressed: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  dangerLabel: { color: colors.danger, fontSize: 15, fontWeight: "500" },
  labelSm: { fontSize: 13 },
  disabled: { opacity: 0.45 },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillNeutral: { backgroundColor: colors.elevated, borderColor: colors.line },
  pillAccent: { backgroundColor: colors.accentBg, borderColor: "rgba(81, 103, 252, 0.35)" },
  pillOk: { backgroundColor: colors.okBg, borderColor: colors.okBorder },
  pillDanger: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
  pillText: { fontSize: 12, fontWeight: "600" },
  pillTextNeutral: { color: colors.muted },
  pillTextAccent: { color: colors.accent },
  pillTextOk: { color: colors.ok },
  pillTextDanger: { color: colors.danger },
  empty: { alignItems: "center", gap: 8, paddingVertical: 24, paddingHorizontal: 8 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "600" },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 300 },
  emptyAction: { marginTop: 8 },
  noticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  noticeBoxDanger: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
  noticeBoxOk: { backgroundColor: colors.okBg, borderColor: colors.okBorder },
  noticeText: { fontSize: 13, lineHeight: 19 },
  noticeTextDanger: { color: colors.danger },
  noticeTextOk: { color: colors.ok },
});
