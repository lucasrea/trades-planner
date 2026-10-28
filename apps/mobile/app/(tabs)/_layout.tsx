import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ color, fontSize: 16, lineHeight: 18 }}>{glyph}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: colors.line,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <TabIcon glyph="⌂" color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: ({ color }) => <TabIcon glyph="▣" color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: "Documents", tabBarIcon: ({ color }) => <TabIcon glyph="☰" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <TabIcon glyph="⚙" color={color} /> }} />
    </Tabs>
  );
}
