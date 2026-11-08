import { Tabs } from "expo-router";
import { ColorValue, Text, View } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 16, lineHeight: 18 }}>{glyph}</Text>;
}

function PlanIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ width: 18, height: 16 }}>
      <View
        style={{
          width: 16,
          height: 11,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 3,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {[5, 8, 4].map((height, index) => (
          <View key={index} style={{ width: 1.5, height, borderRadius: 1, backgroundColor: color }} />
        ))}
      </View>
      <View
        style={{
          position: "absolute",
          left: 3,
          bottom: 1,
          width: 0,
          height: 0,
          borderRightWidth: 5,
          borderTopWidth: 4,
          borderRightColor: "transparent",
          borderTopColor: color,
        }}
      />
    </View>
  );
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
      <Tabs.Screen name="index" options={{ title: "Plan", tabBarIcon: ({ color }) => <PlanIcon color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: ({ color }) => <TabIcon glyph="▣" color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: "Documents", tabBarIcon: ({ color }) => <TabIcon glyph="☰" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <TabIcon glyph="⚙" color={color} /> }} />
    </Tabs>
  );
}
