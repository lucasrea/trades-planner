import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line px-6 py-4">
        <Link href="/" className="font-semibold text-ink">
          Trades Planner
        </Link>
      </header>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Terms</h1>
        <p className="mt-4 text-muted">
          Trades Planner is an early-access service. Keep copies of documents you send to clients and
          verify quote, invoice, and tax details before relying on them. The software is provided
          as-is while we continue to improve it.
        </p>
      </article>
      <footer className="border-t border-line px-6 py-8 text-center text-sm text-muted">
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
