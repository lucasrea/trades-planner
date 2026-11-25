import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
      <div className="card w-full max-w-md px-8 py-10">
        <span className="inline-flex rounded-full border border-line bg-elevated px-2.5 py-0.5 text-xs font-medium text-muted">
          404
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted">That link doesn’t exist, or the record was removed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
          <Link href="/app" className="btn btn-primary">
            Back to Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
