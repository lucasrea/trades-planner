import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="border-b border-line bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Trades Planner
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/pricing" className="text-muted hover:text-ink">
            Pricing
          </Link>
          <Link href="/login" className="text-muted hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted">
        <p>© {new Date().getFullYear()} Trades Planner · Local MVP</p>
        <div className="flex gap-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
