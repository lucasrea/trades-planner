import { router } from "expo-router";
import { EmptyState, Header, PrimaryButton, Screen } from "../../../src/ui";

export default function JobsScreen() {
  return (
    <Screen>
      <Header title="Jobs" subtitle="Active work and quoted jobs." />
      <PrimaryButton label="New job" onPress={() => router.push("/jobs/new")} />
      <EmptyState
        title="No jobs yet"
        body="A job is a site and a client. You can also start from a quote and attach a job later."
        action={<PrimaryButton label="New job" onPress={() => router.push("/jobs/new")} />}
      />
    </Screen>
  );
}
