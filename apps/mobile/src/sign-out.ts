import { router } from "expo-router";
import { revokeSession } from "./api";
import { signOutOfGoogle } from "./google-sign-in";
import { clearBearer, getBearer } from "./session";

/**
 * Revokes the session on the server, then forgets it here. With no connection the phone still logs
 * out; the unused server session then lapses on its own expiry.
 */
export async function logOut() {
  const bearer = await getBearer();
  if (bearer) await revokeSession(bearer).catch(() => {});
  await clearBearer();
  await signOutOfGoogle();
  // Replacing the tabs also drops whatever this account had on screen.
  router.replace("/sign-in");
}
