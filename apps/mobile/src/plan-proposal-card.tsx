import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type PlanLineEdit, type PlanPreview } from "./api";
import { formatCad } from "./money";
import { PlanLineEditor } from "./plan-line-editor";
import { GhostButton, Notice, PrimaryButton } from "./ui";
import { colors } from "./theme";

function linesSubtotal(lines: PlanPreview["lines"]) {
  if (lines.length === 0) return null;
  if (lines.some((line) => line.unitPrice == null || !Number.isFinite(line.quantity))) return null;
  return lines.reduce(
    (sum, line) => sum + Math.round((line.quantity * (line.unitPrice ?? 0) + Number.EPSILON) * 100) / 100,
    0,
  );
}

export function PlanProposalCard({
  preview,
  working,
  disabled,
  error,
  onConfirm,
  onCancel,
  onSaveLines,
}: {
  preview: PlanPreview;
  /** What this card is waiting on the server for. */
  working: "confirm" | "cancel" | "save" | null;
  /** Something is in flight, here or on another card. */
  disabled: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onSaveLines: (lines: PlanLineEdit[]) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const subtotal = linesSubtotal(preview.lines);
  const alerts = [...(preview.blockers ?? []), ...(preview.warnings ?? [])];
  // Tracked lines are the job's own rows and a change card is not a list of lines: neither is edited here.
  const editable = preview.action !== "invoice_tracked" && preview.action !== "change" && preview.lines.length > 0;

  const details: { label: string; value: string }[] = [];
  if (preview.jobTitle) {
    details.push({
      label: preview.action === "create_job" ? "Title" : "Job",
      value: `${preview.jobTitle}${preview.jobIsNew ? " (new job)" : ""}`,
    });
  }
  if (preview.clientName) {
    details.push({ label: "Client", value: `${preview.clientName}${preview.clientIsNew ? " (new client)" : ""}` });
  }
  if (preview.siteAddress) details.push({ label: "Site", value: preview.siteAddress });
  details.push(...(preview.changes ?? []));
  if (preview.notes) details.push({ label: "Notes", value: preview.notes });

  return (
    <View style={styles.proposalCard}>
      <View style={styles.proposalHead}>
        <View style={styles.proposalHeadCopy}>
          <Text style={styles.eyebrow}>Review before saving</Text>
          <Text style={styles.previewTitle}>{preview.title}</Text>
        </View>
        {subtotal != null && !editing ? (
          <View style={styles.subtotalBadge}>
            <Text style={styles.subtotalText}>{formatCad(subtotal)}</Text>
          </View>
        ) : null}
      </View>

      {details.length > 0 ? (
        <View style={styles.metaBox}>
          {details.map((row, index) => (
            // Two rows can share a label ("Remove" twice), so the index is part of the key.
            <View key={`${row.label}-${index}`} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {editing ? (
        <PlanLineEditor
          lines={preview.lines}
          busy={disabled}
          onDiscard={() => setEditing(false)}
          onSave={async (lines) => {
            const saved = await onSaveLines(lines);
            if (saved) setEditing(false);
            return saved;
          }}
        />
      ) : preview.lines.length > 0 ? (
        <View style={styles.linesBox}>
          {preview.lines.map((line, index) => {
            const lineAmount = line.unitPrice != null ? formatCad(line.quantity * line.unitPrice) : null;
            return (
              <View key={index} style={[styles.lineRow, index > 0 ? styles.lineRowBorder : null]}>
                <View style={styles.lineCopy}>
                  <Text style={styles.lineDesc}>{line.description}</Text>
                  <Text style={styles.lineMeta}>
                    {line.quantity} {line.unit}
                    {line.unitPrice != null ? ` × ${formatCad(line.unitPrice)}` : ""}
                  </Text>
                  {line.note ? <Text style={styles.lineNote}>{line.note}</Text> : null}
                </View>
                {lineAmount ? <Text style={styles.lineAmount}>{lineAmount}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {alerts.length > 0 ? (
        <View style={styles.alertBox}>
          {alerts.map((message, index) => (
            <Text key={index} style={styles.alertText}>
              {message}
            </Text>
          ))}
        </View>
      ) : null}

      {error ? <Notice>{error}</Notice> : null}

      {editing ? null : (
        <View style={styles.proposalFooter}>
          <View style={styles.actions}>
            <GhostButton label={working === "cancel" ? "Cancelling…" : "Cancel"} disabled={disabled} onPress={onCancel} />
            {editable ? <GhostButton label="Edit lines" disabled={disabled} onPress={() => setEditing(true)} /> : null}
            <PrimaryButton
              size="sm"
              fullWidth={false}
              label={working === "confirm" ? "Confirming…" : "Confirm"}
              disabled={disabled || !preview.canConfirm}
              onPress={onConfirm}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  proposalCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  proposalHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  proposalHeadCopy: { flex: 1, gap: 3 },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  previewTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  subtotalBadge: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  subtotalText: { color: colors.ink, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  metaBox: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  metaRow: { flexDirection: "row", gap: 12 },
  metaLabel: { color: colors.muted, fontSize: 12, fontWeight: "500", width: 52 },
  metaValue: { color: colors.ink, fontSize: 13, flex: 1 },
  linesBox: {
    backgroundColor: colors.navy2,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  lineRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 11 },
  lineRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  lineCopy: { flex: 1, gap: 2 },
  lineDesc: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  lineMeta: { color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  lineNote: { color: colors.danger, fontSize: 12, marginTop: 2 },
  lineAmount: { color: colors.ink, fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  alertBox: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  alertText: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  proposalFooter: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
});