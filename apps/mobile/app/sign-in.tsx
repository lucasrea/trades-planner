import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { exchangeIdToken, type SignInProvider } from "../src/api";
import { getAppleIdToken } from "../src/apple-sign-in";
import { getGoogleIdToken, GOOGLE_CONFIGURED, signOutOfGoogle } from "../src/google-sign-in";
import { setBearer } from "../src/session";
import { Card, Header, Notice, PrimaryButton, Screen } from "../src/ui";
import { colors } from "../src/theme";

const SITE = "https://trades-planner-bay.vercel.app";

export default function SignInScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [error, setError] = useState<string | null>(reason === "expired" ? "Your session ended. Log in again." : null);
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  // Apple's button cannot be disabled, so a ref stops a second sign-in from starting.
  const busyRef = useRef(false);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  async function signIn(provider: SignInProvider, getIdToken: () => Promise<string | null>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) return;
      await setBearer(await exchangeIdToken(provider, idToken));
      router.replace("/(tabs)");
    } catch (err) {
      // So the next try can choose a different Google account.
      if (provider === "google") await signOutOfGoogle();
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen contentStyle={styles.centered}>
      <Card style={styles.card}>
        <Header
          eyebrow="Trades Planner"
          title="Log in"
          subtitle="Use the account with this business's email."
        />
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton
          label={!GOOGLE_CONFIGURED ? "Google client id is not set" : busy ? "Signing in…" : "Continue with Google"}
          disabled={!GOOGLE_CONFIGURED || busy}
          onPress={() => void signIn("google", getGoogleIdToken)}
        />
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={() => void signIn("apple", getAppleIdToken)}
          />
        ) : null}
      </Card>
      <View style={styles.footer}>
        <Pressable onPress={() => void Linking.openURL(`${SITE}/terms`)}>
          {({ pressed }) => <Text style={[styles.link, pressed ? styles.linkPressed : null]}>Terms</Text>}
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={() => void Linking.openURL(`${SITE}/privacy`)}>
          {({ pressed }) => <Text style={[styles.link, pressed ? styles.linkPressed : null]}>Privacy</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, justifyContent: "center" },
  card: { padding: 20, gap: 16 },
  appleButton: { alignSelf: "stretch", height: 44 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "center", alignItems: "center" },
  link: { color: colors.muted, fontSize: 13 },
  linkPressed: { color: colors.ink },
  dot: { color: colors.muted, fontSize: 13 },
});
