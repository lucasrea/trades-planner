import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted">That link doesn’t exist, or the record was removed.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
        <Link href="/app" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
