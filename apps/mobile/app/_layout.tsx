import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, View } from "react-native";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, height: "100%", alignItems: "center", backgroundColor: "#000" }}>
      <View style={{ flex: 1, height: "100%", width: "100%", maxWidth: Platform.OS === "web" ? 430 : undefined }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: "Log in" }} />
      </Stack>
      </View>
    </View>
  );
}
