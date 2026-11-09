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
        <h2 className="mt-8 text-xl font-semibold">What the AI sees</h2>
        <p className="mt-2 text-muted">
          When you type a description, speak into the microphone, or photograph a receipt, that text,
          the voice transcript, or the receipt photo is sent to our AI model provider so it can draft
          lines for you to review. Nothing becomes part of a quote or invoice until you confirm it.
        </p>
        <h2 className="mt-8 text-xl font-semibold">What we keep</h2>
        <p className="mt-2 text-muted">
          Typed text, voice transcripts, and receipt photos are stored with your account. Audio files
          are not kept: only the transcript is.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Your data</h2>
        <p className="mt-2 text-muted">
          In Settings you can download your data as a JSON file at any time. Deleting your account
          removes your data, including transcripts and receipt photos.
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
