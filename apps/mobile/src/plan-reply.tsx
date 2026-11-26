import { Pressable, StyleSheet, Text, View } from "react-native";
import { type PlanLineEdit } from "./api";
import { PlanProposalCard } from "./plan-proposal-card";
import { type PlanThreadMessage } from "./plans";
import { StatusPill } from "./ui";
import { colors } from "./theme";

export type CardAction = { captureId: string; kind: "confirm" | "cancel" | "save" };

/** One Plan message: a card waiting for review, what became of a card, a question, or an answer. */
export function PlanReply({
  message,
  working,
  disabled,
  error,
  onConfirm,
  onCancel,
  onSaveLines,
  onChoose,
}: {
  message: PlanThreadMessage;
  working: CardAction | null;
  disabled: boolean;
  /** Shown on this message's card. */
  error: string | null;
  onConfirm: (captureId: string) => void;
  onCancel: (captureId: string) => void;
  onSaveLines: (captureId: string, lines: PlanLineEdit[]) => Promise<boolean>;
  /** Set only on the latest question, so old choices can't be tapped. */
  onChoose?: (label: string, jobId: string | null) => void;
}) {
  const { captureId, preview, outcome } = message;

  if (outcome === "cancelled") return <StatusPill label="Cancelled. Nothing was saved." />;
  if (outcome === "confirmed") {
    return <StatusPill tone="ok" label={message.captureType === "receipt" ? "Confirmed" : `Confirmed. ${message.body}`} />;
  }
  if (captureId && preview) {
    return (
      <PlanProposalCard
        preview={preview}
        working={working?.captureId === captureId ? working.kind : null}
        disabled={disabled}
        error={error}
        onConfirm={() => onConfirm(captureId)}
        onCancel={() => onCancel(captureId)}
        onSaveLines={(lines) => onSaveLines(captureId, lines)}
      />
    );
  }
  return (
    <View style={styles.replyBox}>
      <Text style={styles.replyText}>{message.body}</Text>
      {!captureId && message.options.length > 0 ? (
        <View style={styles.choices}>
          {message.options.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              disabled={!onChoose || disabled}
              onPress={() => onChoose?.(option.label, option.jobId)}
              style={({ pressed }) => [
                styles.choice,
                pressed ? styles.choicePressed : null,
                !onChoose || disabled ? styles.choiceOff : null,
              ]}
            >
              <Text style={styles.choiceText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  replyBox: { paddingHorizontal: 2, paddingVertical: 4, gap: 8 },
  replyText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  choicePressed: { backgroundColor: colors.elevated, borderColor: colors.elevatedBorder },
  choiceOff: { opacity: 0.6 },
  choiceText: { color: colors.ink, fontSize: 13, fontWeight: "500" },
});
