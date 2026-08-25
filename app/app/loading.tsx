export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded bg-line" />
      <div className="h-4 w-72 max-w-full rounded bg-line/70" />
      <div className="card h-40 rounded-xl bg-line/40" />
    </div>
  );
}
