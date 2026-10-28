import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Card, Header, Notice, Screen } from "../../src/ui";
import { colors } from "../../src/theme";

const SECTIONS = [
  {
    id: "business",
    title: "Business",
    description: "Shown on quotes and invoices.",
    rows: ["Business name", "Address", "Phone", "Email"],
  },
  {
    id: "tax",
    title: "Tax",
    description: "GST/HST details for PDFs.",
    rows: ["GST/HST number", "Tax label", "Tax rate"],
  },
  {
    id: "rates",
    title: "Rates",
    description: "Defaults for new quotes.",
    rows: ["Labour rate", "Material markup"],
  },
  {
    id: "payment",
    title: "Getting paid",
    description: "Printed on invoices.",
    rows: ["e-Transfer email", "Payment note"],
  },
] as const;

export default function SettingsScreen() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Screen>
      <Header title="Settings" subtitle="This is what prints on quotes and invoices." />
      <Card>
        <Text style={styles.account}>Not signed in</Text>
        <Text style={styles.muted}>Use the Google account for this business.</Text>
        <Pressable onPress={() => router.push("/sign-in")}>
          <Text style={styles.link}>Continue with Google</Text>
        </Pressable>
      </Card>
      {SECTIONS.map((section) => (
        <Card key={section.id}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.muted}>{section.description}</Text>
            </View>
            <Pressable onPress={() => setNotice("Editing on the phone isn’t connected yet.")}>
              <Text style={styles.link}>Edit</Text>
            </Pressable>
          </View>
          {section.rows.map((row) => (
            <View key={row}>
              <Text style={styles.muted}>{row}</Text>
              <Text style={styles.value}>—</Text>
            </View>
          ))}
        </Card>
      ))}
      {notice ? <Notice>{notice}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  sectionHead: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  value: { color: colors.ink, fontSize: 15, marginTop: 2 },
});
