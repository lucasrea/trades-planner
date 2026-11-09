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
          Trades Planner is an early-access service, provided as-is while we continue to improve it.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Check before you send</h2>
        <p className="mt-2 text-muted">
          The AI drafts lines for you to review. You must check the totals, tax, and names on every
          quote and invoice before you send it to a client. You are responsible for what you send.
          Keep copies of documents you send.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Deleting your account</h2>
        <p className="mt-2 text-muted">
          You can delete your account in Settings. Deleting your account removes your data, and it
          cannot be undone.
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
