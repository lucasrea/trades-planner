import Link from "next/link";

export function UpgradeNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-6 text-sm text-accent" role="alert">
      {children}{" "}
      <Link href="/#pricing" className="font-medium underline hover:text-ink">
        See plans
      </Link>
    </p>
  );
}
