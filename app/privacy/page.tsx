import { MarketingFooter, MarketingNav } from "@/components/marketing";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <article className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Privacy</h1>
        <p className="mt-4 text-muted">
          This local MVP stores your account and job data in a SQLite file on the computer running the app
          (<code>data/sitebook.db</code>). Nothing is sent to a cloud database yet. When we add hosting, this page will
          describe that in plain language.
        </p>
      </article>
      <MarketingFooter />
    </div>
  );
}
