import { Stack } from "expo-router";
import { colors } from "../../../src/theme";

export default function JobsLayout() {
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
      <Stack.Screen name="new" options={{ title: "New job" }} />
    </Stack>
  );
}
