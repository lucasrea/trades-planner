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
