export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-elevated" />
        <div className="h-4 w-64 max-w-full rounded-lg bg-card" />
      </div>
      <div className="card h-56 rounded-2xl bg-card" />
    </div>
  );
}
