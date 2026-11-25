import { Tabs } from "expo-router";
import { ColorValue, View } from "react-native";
import { colors } from "../../src/theme";

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

function JobsIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ width: 18, height: 16, alignItems: "center", justifyContent: "flex-end" }}>
      <View
        style={{
          width: 7,
          height: 3.5,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          borderWidth: 1.5,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
      <View
        style={{
          width: 16,
          height: 11,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 3,
        }}
      />
    </View>
  );
}

function DocumentsIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={{
        width: 14,
        height: 16,
        borderWidth: 1.5,
        borderColor: color,
        borderRadius: 3,
        justifyContent: "center",
        paddingHorizontal: 2.5,
        gap: 2.5,
      }}
    >
      <View style={{ height: 1.5, width: "100%", borderRadius: 1, backgroundColor: color }} />
      <View style={{ height: 1.5, width: "100%", borderRadius: 1, backgroundColor: color }} />
      <View style={{ height: 1.5, width: "65%", borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}

function SettingsIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ width: 16, height: 16, justifyContent: "center", gap: 3.5 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 5, height: 5, borderRadius: 99, borderWidth: 1.5, borderColor: color, backgroundColor: colors.navy }} />
        <View style={{ width: 3, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 3, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 5, height: 5, borderRadius: 99, borderWidth: 1.5, borderColor: color, backgroundColor: colors.navy }} />
        <View style={{ flex: 1, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      </View>
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
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Plan", tabBarIcon: ({ color }) => <PlanIcon color={color} /> }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs", tabBarIcon: ({ color }) => <JobsIcon color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: "Documents", tabBarIcon: ({ color }) => <DocumentsIcon color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }} />
    </Tabs>
  );
}
