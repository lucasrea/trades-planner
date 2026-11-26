import { useCallback, useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { cancelCapture, confirmReceipt, fetchReceiptReview, type ReceiptReview } from "../../src/api";
import { applyMarkup } from "../../src/money";
import { parseAmount } from "../../src/numbers";
import { OptionSheet } from "../../src/option-sheet";
import { getBearer } from "../../src/session";
import { Card, DangerButton, GhostButton, Notice, PrimaryButton, SecondaryButton } from "../../src/ui";
import { colors } from "../../src/theme";

const NEW_PREFIX = "new:";

type Line = { key: number; description: string; quantity: string; cost: string; price: string; jobId: string | null };
type NewJob = { key: string; title: string; clientId: string | null; clientName: string };

function amount(text: string) {
  const value = parseAmount(text);
  return value == null || Number.isNaN(value) ? null : value;
}

function lineIsComplete(line: Line) {
  const quantity = amount(line.quantity);
  return Boolean(
    line.jobId && line.description.trim() && quantity != null && quantity > 0 && amount(line.cost) != null && amount(line.price) != null,
  );
}

/** Leave the receipt screen, then open the job over the tabs. */
function openJob(jobId: string) {
  if (router.canGoBack()) router.back();
  router.push(`/jobs/${jobId}`, { withAnchor: true });
}

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const captureId = typeof id === "string" ? id : "";
  const [receipt, setReceipt] = useState<ReceiptReview | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [newJobs, setNewJobs] = useState<NewJob[]>([]);
  /** The line whose job is being picked, "all" for every line, or null when the sheet is closed. */
  const [picking, setPicking] = useState<number | "all" | null>(null);
  const [clientFor, setClientFor] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<{ id: string; title: string }[] | null>(null);
  const [busy, setBusy] = useState<"confirm" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const nextJobRef = useRef(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setError("Sign in on the Settings tab first.");
        return;
      }
      const loaded = await fetchReceiptReview(bearer, captureId);
      setReceipt(loaded);
      setLines(
        loaded.lines.map((line, index) => ({
          key: index,
          description: line.description,
          quantity: String(line.quantity),
          cost: String(line.cost),
          price: String(line.price),
          jobId: line.jobId,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this receipt.");
    }
  }, [captureId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateLine(key: number, patch: Partial<Line>) {
    setError(null);
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateNewJob(key: string, patch: Partial<NewJob>) {
    setError(null);
    setNewJobs((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeNewJob(key: string) {
    setNewJobs((rows) => rows.filter((row) => row.key !== key));
    setLines((rows) => rows.map((row) => (row.jobId === `${NEW_PREFIX}${key}` ? { ...row, jobId: null } : row)));
  }

  const jobOptions = [
    ...(receipt?.jobs ?? []).map((job) => ({ id: job.id, label: job.title })),
    ...newJobs.map((job, index) => ({ id: `${NEW_PREFIX}${job.key}`, label: `New: ${job.title.trim() || `job ${index + 1}`}` })),
  ];
  const jobLabel = (jobId: string | null) => jobOptions.find((option) => option.id === jobId)?.label ?? "Choose a job";
  const usedNewJobs = newJobs.filter((job) => lines.some((line) => line.jobId === `${NEW_PREFIX}${job.key}`));
  const canConfirm =
    lines.length > 0 &&
    lines.every(lineIsComplete) &&
    usedNewJobs.every((job) => job.title.trim() && (job.clientId || job.clientName.trim()));

  async function run(kind: "confirm" | "discard", work: (bearer: string) => Promise<void>) {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(kind);
    setError(null);
    try {
      const bearer = await getBearer();
      if (!bearer) {
        setError("Sign in on the Settings tab first.");
        return;
      }
      await work(bearer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      runningRef.current = false;
      setBusy(null);
    }
  }

  function confirm() {
    void run("confirm", async (bearer) => {
      const result = await confirmReceipt(bearer, captureId, {
        lines: lines.map((line) => ({
          kind: "material",
          description: line.description.trim(),
          quantity: amount(line.quantity)!,
          unit: "ea",
          unitCost: amount(line.cost)!,
          unitPrice: amount(line.price)!,
          jobId: line.jobId!,
        })),
        newJobs: usedNewJobs.map((job) => ({
          key: job.key,
          title: job.title.trim(),
          client: job.clientId ? { id: job.clientId } : { name: job.clientName.trim() },
        })),
      });
      if (result.jobIds.length === 1) return openJob(result.jobIds[0]!);
      // More than one job: show them all. Reload for the titles of jobs started here.
      const titles = (await fetchReceiptReview(bearer, captureId).catch(() => receipt))?.jobs ?? [];
      setAddedTo(result.jobIds.map((jobId) => ({ id: jobId, title: titles.find((job) => job.id === jobId)?.title ?? "Job" })));
    });
  }

  function discard() {
    void run("discard", async (bearer) => {
      await cancelCapture(bearer, captureId);
      router.back();
    });
  }

  const header = <Stack.Screen options={{ title: "Receipt" }} />;

  if (addedTo) {
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        {header}
        <Notice tone="ok">{`Receipt added to ${addedTo.length} jobs. The items are unbilled materials; no invoice was created.`}</Notice>
        {addedTo.map((job) => (
          <SecondaryButton key={job.id} fullWidth label={`Open ${job.title}`} onPress={() => openJob(job.id)} />
        ))}
        <GhostButton label="Back to Plan" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  if (!receipt || receipt.status !== "needs_review") {
    const message = !receipt
      ? null
      : receipt.status === "failed"
        ? (receipt.error ?? "I couldn't read that receipt.")
        : receipt.status === "confirmed"
          ? "This receipt is already on its jobs."
          : receipt.status === "processing"
            ? "Reading your receipt…"
            : "This receipt was discarded.";
    return (
      <ScrollView contentContainerStyle={styles.wrap}>
        {header}
        {error ? <Notice>{error}</Notice> : null}
        {message ? <Text style={styles.body}>{message}</Text> : error ? null : <Text style={styles.muted}>Loading…</Text>}
        {error || receipt?.status === "processing" ? <SecondaryButton label="Try again" onPress={() => void load()} /> : null}
        <GhostButton label="Back" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      {header}
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Card>
          {receipt.imageUrl ? (
            <Image source={{ uri: receipt.imageUrl }} style={styles.photo} resizeMode="contain" accessibilityLabel="Receipt photo" />
          ) : (
            <Text style={styles.muted}>The photo is not available to show.</Text>
          )}
          <Text style={styles.body}>
            {receipt.vendor?.trim() || "Vendor not printed"} · {receipt.purchasedAt || "Date not printed"}
          </Text>
          {receipt.note?.trim() ? <Text style={styles.muted}>Your note: {receipt.note}</Text> : null}
          <Text style={styles.muted}>
            Sell price is cost plus your {receipt.markupPct}% material markup. Nothing is saved until you confirm, and no invoice is created.
          </Text>
        </Card>

        <View style={styles.actions}>
          <SecondaryButton size="sm" label="Put every line on…" onPress={() => setPicking("all")} />
          <GhostButton
            label="Start a new job"
            onPress={() => {
              const key = `job${nextJobRef.current++}`;
              setNewJobs((rows) => [...rows, { key, title: "", clientId: receipt.clients[0]?.id ?? null, clientName: "" }]);
            }}
          />
        </View>

        {newJobs.map((job, index) => (
          <Card key={job.key}>
            <Text style={styles.heading}>New job {index + 1}</Text>
            <Field label="Title" value={job.title} onChange={(title) => updateNewJob(job.key, { title })} />
            {job.clientId ? (
              <View style={styles.actions}>
                <SecondaryButton
                  size="sm"
                  label={`Client: ${receipt.clients.find((client) => client.id === job.clientId)?.name ?? "Choose"}`}
                  onPress={() => setClientFor(job.key)}
                />
                <GhostButton label="New client" onPress={() => updateNewJob(job.key, { clientId: null })} />
              </View>
            ) : (
              <>
                <Field label="New client name" value={job.clientName} onChange={(clientName) => updateNewJob(job.key, { clientName })} />
                {receipt.clients.length > 0 ? (
                  <GhostButton label="Existing client" onPress={() => setClientFor(job.key)} />
                ) : null}
              </>
            )}
            <GhostButton label="Remove this job" onPress={() => removeNewJob(job.key)} />
          </Card>
        ))}

        {lines.map((line) => (
          <Card key={line.key}>
            <Field label="Item" value={line.description} onChange={(description) => updateLine(line.key, { description })} />
            <View style={styles.numbers}>
              <Field label="Qty" numeric value={line.quantity} onChange={(quantity) => updateLine(line.key, { quantity })} />
              <Field
                label="Cost"
                numeric
                value={line.cost}
                onChange={(cost) => {
                  const value = amount(cost);
                  updateLine(line.key, { cost, price: value == null ? "" : String(applyMarkup(value, receipt.markupPct)) });
                }}
              />
              <Field label="Sell price" numeric value={line.price} onChange={(price) => updateLine(line.key, { price })} />
            </View>
            <View style={styles.actions}>
              <SecondaryButton size="sm" label={jobLabel(line.jobId)} onPress={() => setPicking(line.key)} />
              <GhostButton label="Remove line" onPress={() => setLines((rows) => rows.filter((row) => row.key !== line.key))} />
            </View>
          </Card>
        ))}
        {lines.length === 0 ? <Text style={styles.muted}>No lines left. Discard this receipt or go back.</Text> : null}

        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton label={busy === "confirm" ? "Confirming…" : "Confirm"} disabled={!canConfirm || busy !== null} onPress={confirm} />
        <DangerButton fullWidth label={busy === "discard" ? "Discarding…" : "Discard receipt"} disabled={busy !== null} onPress={discard} />
      </ScrollView>

      <OptionSheet
        visible={picking !== null}
        title={picking === "all" ? "Put every line on" : "Job for this line"}
        options={jobOptions}
        currentId={typeof picking === "number" ? (lines.find((line) => line.key === picking)?.jobId ?? null) : null}
        status={jobOptions.length === 0 ? "No open jobs. Start a new job." : null}
        onClose={() => setPicking(null)}
        onSelect={(jobId) => {
          setError(null);
          setLines((rows) => rows.map((row) => (picking === "all" || row.key === picking ? { ...row, jobId } : row)));
        }}
      />
      <OptionSheet
        visible={clientFor !== null}
        title="Client"
        options={receipt.clients.map((client) => ({ id: client.id, label: client.name }))}
        currentId={newJobs.find((job) => job.key === clientFor)?.clientId ?? null}
        onClose={() => setClientFor(null)}
        onSelect={(clientId) => {
          if (clientFor) updateNewJob(clientFor, { clientId });
        }}
      />
    </KeyboardAvoidingView>
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
    <View style={numeric ? styles.numberField : styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        keyboardType={numeric ? "decimal-pad" : "default"}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 12, padding: 20, paddingBottom: 40 },
  photo: { width: "100%", height: 240, borderRadius: 10 },
  heading: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  body: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  numbers: { flexDirection: "row", gap: 8 },
  field: { gap: 3 },
  numberField: { flex: 1, gap: 3 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  input: {
    color: colors.ink,
    backgroundColor: colors.input,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
