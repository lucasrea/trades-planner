import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

const KEY = "tp_mobile_bearer";

export async function getBearer(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setBearer(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearBearer() {
  await SecureStore.deleteItemAsync(KEY);
}

let expiring: Promise<void> | null = null;

/** The server refused this bearer (expired or revoked): forget it and go to sign-in. */
export function expireSession(token: string) {
  // Requests that fail together share one run, so the screen changes once.
  expiring ??= (async () => {
    // A late answer to an old request must not remove the token from a newer sign-in.
    if ((await getBearer()) !== token) return;
    await clearBearer();
    router.replace({ pathname: "/sign-in", params: { reason: "expired" } });
  })().finally(() => {
    expiring = null;
  });
  return expiring;
}
