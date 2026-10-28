import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Card, Header, Notice, PrimaryButton, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

const EXAMPLES = [
  "Quote Mrs Patel at 14 Elm, replace water heater, four hours labour, tank is 780.",
  "Invoice Chen for yesterday: two hours labour and a $45 valve.",
  "Log three hours on the kitchen rough-in.",
];

const LINKS = [
  { href: "/jobs", label: "Jobs", detail: "Sites, tracked lines, and new drafts" },
  { href: "/documents", label: "Documents", detail: "Quotes and invoices in one list" },
] as const;

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError("Phone sign-in isn’t connected yet. Your text is still here.");
  }

  return (
    <Screen>
      <Header title="Home" subtitle="Describe a job, or jump to your paperwork." />
      <Card>
        <Text style={styles.cardTitle}>Describe it</Text>
        <Text style={styles.cardBody}>Type the job. You’ll review the lines before anything is saved.</Text>
        <TextInput
          accessibilityLabel="Describe the job"
          multiline
          maxLength={4000}
          onChangeText={setText}
          placeholder="Quote Mrs Patel at 14 Elm…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={text}
        />
        <View style={styles.chips}>
          {EXAMPLES.map((example) => (
            <Pressable key={example} onPress={() => setText(example)} style={styles.chip}>
              <Text style={styles.chipLabel}>{example.slice(0, 42)}…</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton disabled={!text.trim()} label="Describe" onPress={submit} />
      </Card>
      <Card>
        {LINKS.map((link, index) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            style={[styles.link, index > 0 ? styles.linkBorder : null]}
          >
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkDetail}>{link.detail}</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "600" },
  cardBody: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 120,
    padding: 12,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  chip: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: { color: colors.ink, fontSize: 13 },
  link: { gap: 4, paddingVertical: 12 },
  linkBorder: { borderTopColor: colors.line, borderTopWidth: 1 },
  linkLabel: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  linkDetail: { color: colors.muted, fontSize: 14 },
});
