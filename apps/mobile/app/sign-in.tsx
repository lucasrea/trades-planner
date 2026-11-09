import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { exchangeGoogleIdToken } from "../src/api";
import { GOOGLE_CLIENT_ID } from "../src/config";
import { setBearer } from "../src/session";
import { Card, Header, Notice, PrimaryButton, Screen } from "../src/ui";
import { colors } from "../src/theme";

WebBrowser.maybeCompleteAuthSession();

const SITE = "https://trades-planner-bay.vercel.app";

export default function SignInScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientMissing = !GOOGLE_CLIENT_ID;

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) {
      setError("Google did not return an ID token.");
      return;
    }
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const bearer = await exchangeGoogleIdToken(idToken);
        await setBearer(bearer);
        router.replace("/(tabs)");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed.");
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  return (
    <Screen>
      <Card>
        <Header title="Log in" subtitle="Use the Google account for this business." />
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton
          label={clientMissing ? "Google client id is not set" : busy ? "Signing in…" : "Continue with Google"}
          disabled={clientMissing || busy || !request}
          onPress={() => {
            if (clientMissing) return;
            void promptAsync();
          }}
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
