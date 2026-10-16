import Link from "next/link";
import { GoogleAuthCard } from "@/components/google-auth-card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line px-6 py-4">
        <Link href="/" className="font-semibold text-ink">
          Trades Planner
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <GoogleAuthCard mode="login" next={next} error={error} />
      </div>
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
