import { router } from "expo-router";
import { EmptyState, Header, PrimaryButton, Screen } from "../../../src/ui";

export default function JobsScreen() {
  return (
    <Screen>
      <Header title="Jobs" subtitle="Active work and quoted jobs." />
      <PrimaryButton label="New job" onPress={() => router.push("/jobs/new")} />
      <EmptyState
        title="Jobs aren't loaded"
        body="Sign-in on the phone isn't connected yet, so this list stays empty."
        action={<PrimaryButton label="New job" onPress={() => router.push("/jobs/new")} />}
      />
    </Screen>
  );
}
