import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getBearer } from "../../src/session";
import { logOut } from "../../src/sign-out";
import { Card, DangerButton, GhostButton, Header, Notice, PrimaryButton, Screen, StatusPill } from "../../src/ui";
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
  const [signedIn, setSignedIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getBearer().then((token) => {
        if (active) setSignedIn(Boolean(token));
      });
      return () => {
        active = false;
      };
    }, []),
  );

  async function onSignOut() {
    setLoggingOut(true);
    setNotice(null);
    try {
      await logOut();
    } catch {
      setNotice("Could not log out. Try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Screen>
      <Header title="Settings" subtitle="This is what prints on quotes and invoices." />
      <Card>
        <View style={styles.sectionHead}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Text style={styles.muted}>
              {signedIn ? "Connected to your Trades Planner account." : "Use the account with this business's email."}
            </Text>
          </View>
          <StatusPill label={signedIn ? "Signed in" : "Not signed in"} tone={signedIn ? "ok" : "neutral"} />
        </View>
        {signedIn ? (
          <DangerButton
            label={loggingOut ? "Logging out…" : "Log out"}
            disabled={loggingOut}
            onPress={() => void onSignOut()}
          />
        ) : (
          <PrimaryButton label="Log in" onPress={() => router.push("/sign-in")} />
        )}
      </Card>
      {notice ? <Notice>{notice}</Notice> : null}
      {SECTIONS.map((section) => (
        <Card key={section.id}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.muted}>{section.description}</Text>
            </View>
            <GhostButton label="Edit" onPress={() => setNotice("Editing on the phone isn’t connected yet.")} />
          </View>
          <View style={styles.rowsBox}>
            {section.rows.map((row, index) => (
              <View key={row} style={[styles.rowItem, index > 0 ? styles.rowBorder : null]}>
                <Text style={styles.rowLabel}>{row}</Text>
                <Text style={styles.rowValue}>—</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, justifyContent: "space-between" },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  rowsBox: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 2,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: colors.ink, fontSize: 14, fontWeight: "500" },
});
