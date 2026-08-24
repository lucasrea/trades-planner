"use client";

export function PrintToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print flex items-center justify-between border-b border-line bg-paper px-6 py-3">
      <a href={backHref} className="text-sm underline">
        Back
      </a>
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
