import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Card, Header, Notice, PrimaryButton, Screen } from "../src/ui";
import { colors } from "../src/theme";

const SITE = "https://trades-planner-bay.vercel.app";

export default function SignInScreen() {
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Card>
        <Header title="Log in" subtitle="Use the Google account for this business." />
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton
          label="Continue with Google"
          onPress={() => setError("Google sign-in on the phone isn’t connected yet.")}
        />
      </Card>
      <View style={styles.footer}>
        <Text style={styles.link} onPress={() => void Linking.openURL(`${SITE}/terms`)}>
          Terms
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.link} onPress={() => void Linking.openURL(`${SITE}/privacy`)}>
          Privacy
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: 8, justifyContent: "center" },
  link: { color: colors.muted, fontSize: 14 },
  dot: { color: colors.muted, fontSize: 14 },
});
