import { useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import { pickReceiptPhoto } from "./receipt-photo";
import { Card, GhostButton, Notice, PrimaryButton, SecondaryButton } from "./ui";
import { colors } from "./theme";

/** Take or choose a receipt photo, add a note, and send it. The photo stays here until it is sent. */
export function ReceiptPanel({
  jobTitle,
  busy,
  onSend,
  onClose,
}: {
  jobTitle: string | null;
  busy: boolean;
  /** Resolves false when the upload failed; the photo and note are kept. */
  onSend: (uri: string, note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: "camera" | "library") {
    setError(null);
    setPreparing(true);
    try {
      const uri = await pickReceiptPhoto(source);
      if (uri) setPhoto(uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that photo.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <Card>
      <Text style={styles.title}>Receipt photo</Text>
      {error ? <Notice>{error}</Notice> : null}
      {photo ? (
        <>
          <View style={styles.row}>
            <Image source={{ uri: photo }} style={styles.thumb} accessibilityLabel="Receipt preview" />
            <View style={styles.copy}>
              <TextInput
                accessibilityLabel="Note about this receipt"
                style={styles.input}
                value={note}
                maxLength={500}
                editable={!busy}
                placeholder="Optional: add this to the kitchen"
                placeholderTextColor={colors.muted}
                onChangeText={setNote}
              />
              <Text style={styles.muted}>{jobTitle ? `Goes on ${jobTitle}` : "Choose a job on the next screen"}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <PrimaryButton
              size="sm"
              fullWidth={false}
              label={busy ? "Reading receipt…" : "Read receipt"}
              disabled={busy}
              onPress={() =>
                void onSend(photo, note.trim()).then((sent) => {
                  if (sent) onClose();
                })
              }
            />
            <GhostButton label="Remove photo" disabled={busy} onPress={() => setPhoto(null)} />
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          <SecondaryButton size="sm" label="Take photo" disabled={preparing || busy} onPress={() => void pick("camera")} />
          <SecondaryButton size="sm" label="Choose photo" disabled={preparing || busy} onPress={() => void pick("library")} />
          <GhostButton label="Close" disabled={preparing} onPress={onClose} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: colors.line },
  copy: { flex: 1, gap: 6 },
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
  muted: { color: colors.muted, fontSize: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
