import Link from "next/link";
import { getAuthUser } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";

export async function MarketingNav() {
  const user = await getAuthUser();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Trades Planner
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-5">
          <a href="/#voice" className="hidden text-muted hover:text-ink md:inline">
            Voice
          </a>
          <a href="/#features" className="hidden text-muted hover:text-ink md:inline">
            Features
          </a>
          <a href="/#how" className="hidden text-muted hover:text-ink lg:inline">
            How it works
          </a>
          <a href="/#pricing" className="hidden text-muted hover:text-ink sm:inline">
            Pricing
          </a>
          {user ? (
            <>
              <Link href="/app" className="btn btn-ghost btn-sm">
                Open app
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-muted hover:text-ink sm:inline">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary shrink-0">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
        <p>© {new Date().getFullYear()} Trades Planner</p>
        <div className="flex gap-4">
          <a href="/#voice" className="hover:text-ink">
            Voice
          </a>
          <a href="/#features" className="hover:text-ink">
            Features
          </a>
          <a href="/#pricing" className="hover:text-ink">
            Pricing
          </a>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}