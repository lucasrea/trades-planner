/** Shown while a saved Plan thread loads (sidebar shell stays interactive). */
export function PlanChatSkeleton({ fill = false }: { fill?: boolean }) {
  return (
    <div
      className={`flex min-h-0 flex-col ${fill ? "min-h-[min(70vh,42rem)] lg:min-h-0 lg:h-full" : "gap-3"}`}
      aria-busy="true"
      aria-label="Loading conversation"
    >
      <div className={`${fill ? "min-h-0 flex-1" : ""} animate-pulse space-y-3 overflow-hidden p-1`}>
        <div className="ml-auto h-14 w-4/5 max-w-md rounded-2xl bg-elevated" />
        <div className="h-24 w-full max-w-lg rounded-2xl bg-card" />
        <div className="ml-auto h-10 w-2/5 max-w-xs rounded-2xl bg-elevated" />
      </div>
      {fill ? (
        <div className="shrink-0 animate-pulse space-y-2 pt-2">
          <div className="h-11 rounded-xl bg-card" />
          <div className="h-[4.5rem] rounded-2xl bg-card" />
        </div>
      ) : null}
    </div>
  );
}