import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line px-6 py-4">
        <Link href="/" className="font-semibold text-ink">
          Trades Planner
        </Link>
      </header>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Privacy</h1>
        <p className="mt-4 text-muted">
          Trades Planner stores your account, business, client, job, quote, and invoice data in our
          hosted database so you can access it securely across devices. We use this information only
          to provide and operate the service.
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
