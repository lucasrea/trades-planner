import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { type PlanLineEdit, type PlanPreviewLine } from "./api";
import { parseAmount } from "./numbers";
import { GhostButton, Notice, PrimaryButton } from "./ui";
import { colors } from "./theme";

type Draft = { description: string; quantity: string; unit: string; unitPrice: string };

/** Edits the lines of a waiting card. Nothing is kept until Save reaches the server. */
export function PlanLineEditor({
  lines,
  busy,
  onSave,
  onDiscard,
}: {
  lines: PlanPreviewLine[];
  busy: boolean;
  /** Resolves false when the server refused; the draft stays on screen. */
  onSave: (lines: PlanLineEdit[]) => Promise<boolean>;
  onDiscard: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    lines.map((line) => ({
      description: line.description,
      quantity: String(line.quantity),
      unit: line.unit,
      unitPrice: line.unitPrice == null ? "" : String(line.unitPrice),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  function change(index: number, field: keyof Draft, value: string) {
    setError(null);
    setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function save() {
    const edits: PlanLineEdit[] = [];
    for (const draft of drafts) {
      const quantity = parseAmount(draft.quantity);
      const unitPrice = parseAmount(draft.unitPrice);
      if (quantity == null || Number.isNaN(quantity)) return setError("Every line needs a quantity.");
      if (Number.isNaN(unitPrice)) return setError("Every line needs a price.");
      edits.push({ description: draft.description, quantity, unit: draft.unit, unitPrice });
    }
    void onSave(edits);
  }

  return (
    <View style={styles.editor}>
      {drafts.map((draft, index) => (
        <View key={index} style={styles.line}>
          <TextInput
            accessibilityLabel={`Line ${index + 1} description`}
            style={styles.input}
            value={draft.description}
            maxLength={200}
            onChangeText={(value) => change(index, "description", value)}
          />
          <View style={styles.row}>
            <Field label="Qty" value={draft.quantity} numeric onChange={(value) => change(index, "quantity", value)} />
            <Field label="Unit" value={draft.unit} onChange={(value) => change(index, "unit", value)} />
            <Field label="Price" value={draft.unitPrice} numeric onChange={(value) => change(index, "unitPrice", value)} />
          </View>
        </View>
      ))}
      {error ? <Notice>{error}</Notice> : null}
      <View style={styles.actions}>
        <GhostButton label="Discard edits" disabled={busy} onPress={onDiscard} />
        <PrimaryButton size="sm" fullWidth={false} label={busy ? "Saving…" : "Save lines"} disabled={busy} onPress={save} />
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  numeric,
  onChange,
}: {
  label: string;
  value: string;
  numeric?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize="none"
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 12 },
  line: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  field: { flex: 1, gap: 3 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  input: {
    color: colors.ink,
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
});
