import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Notice, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

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
      <View style={styles.thread}>
        {error ? <Notice>{error}</Notice> : null}
      </View>
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Message"
          multiline
          maxLength={4000}
          onChangeText={setText}
          placeholder="Describe the work"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={text}
        />
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setError("Choosing a job on the phone isn’t connected yet.")}
            style={styles.job}
          >
            <Text style={styles.jobLabel}>New job</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!text.trim()}
            onPress={submit}
            style={[styles.send, !text.trim() ? styles.disabled : null]}
          >
            <Text style={styles.sendLabel}>Send</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thread: { flexGrow: 1, justifyContent: "flex-end", minHeight: 160 },
  composer: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },
  input: {
    color: colors.ink,
    fontSize: 16,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  job: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jobLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  send: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendLabel: { color: "#141414", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.55 },
});
