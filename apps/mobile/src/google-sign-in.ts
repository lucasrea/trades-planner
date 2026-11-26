import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import { GOOGLE_CLIENT_ID } from "./config";

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";

export const GOOGLE_CONFIGURED = Boolean(GOOGLE_CLIENT_ID) && (Platform.OS !== "ios" || Boolean(IOS_CLIENT_ID));

function configure() {
  // The web client id is the server client id, so the ID token is addressed to the web app
  // (its AUTH_GOOGLE_ID), which is the audience the server checks.
  GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID, iosClientId: IOS_CLIENT_ID || undefined });
}

/** Null means the user closed Google's sheet. */
export async function getGoogleIdToken(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken) throw new Error("Google did not return an ID token.");
  return response.data.idToken;
}

/** Forgets the Google account on this phone, so the next sign-in can choose another one. */
export async function signOutOfGoogle() {
  if (!GOOGLE_CONFIGURED) return;
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Not being able to tell Google must not block our own sign-out.
  }
}
