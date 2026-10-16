import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { googleSignInAction } from "@/lib/actions/auth";

const title = "Describe the job. Get the paperwork.";
const description =
  "Quotes and GST/HST invoices for solo trades in Canada — clients, jobs, line items, and print-ready PDFs.";

export const metadata: Metadata = {
  title: `Trades Planner — ${title}`,
  description,
  openGraph: {
    title,
    description,
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Keep clients, jobs, quotes, and invoices in one place — then print or save PDFs with tax
          on the right lines.
        </p>
        <form action={googleSignInAction} className="mt-10 w-full max-w-sm">
          <GoogleSignInButton label="Continue with Google" />
        </form>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink underline">
            Log in
          </Link>
        </p>
      </main>
      <footer className="border-t border-line px-6 py-8 text-center text-sm text-muted">
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        {" · "}
        <a href="mailto:support@example.com" className="hover:text-ink">
          support@example.com
        </a>
      </footer>
    </div>
  );
}
