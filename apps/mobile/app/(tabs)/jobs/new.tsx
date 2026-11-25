import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Notice, PrimaryButton, Screen } from "../../../src/ui";
import { colors } from "../../../src/theme";

const FIELDS = [
  { key: "title", label: "Title", placeholder: "Kitchen rough-in" },
  { key: "client", label: "Client", placeholder: "Patel, Maria" },
  { key: "site", label: "Site address", placeholder: "14 Elm Street" },
  { key: "notes", label: "Notes", placeholder: "Optional" },
] as const;

export default function NewJobScreen() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Card>
        {FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              multiline={field.key === "notes"}
              onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              placeholder={field.placeholder}
              placeholderTextColor={colors.muted}
              style={[styles.input, field.key === "notes" ? styles.notes : null]}
              value={values[field.key] ?? ""}
            />
          </View>
        ))}
        {error ? <Notice>{error}</Notice> : null}
        <View style={styles.submitWrap}>
          <PrimaryButton
            disabled={!values.title?.trim()}
            label="Save job"
            onPress={() => setError("Saving from the phone isn’t connected yet. Nothing was sent.")}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "500" },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  notes: { minHeight: 96, textAlignVertical: "top" },
  submitWrap: { marginTop: 4 },
});
