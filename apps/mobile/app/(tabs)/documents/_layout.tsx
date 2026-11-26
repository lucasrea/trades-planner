import { Stack } from "expo-router";
import { colors } from "../../../src/theme";

/** A detail screen opened from another tab keeps the list underneath it. */
export const unstable_settings = { initialRouteName: "index" };

export default function DocumentsLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.paper },
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Document" }} />
    </Stack>
  );
}