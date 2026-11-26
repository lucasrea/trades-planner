import * as AppleAuthentication from "expo-apple-authentication";

/** Null means the user closed Apple's sheet. Only the email is asked for: it finds the account. */
export async function getAppleIdToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new Error("Apple did not return an ID token.");
    return credential.identityToken;
  } catch (err) {
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw err;
  }
}
