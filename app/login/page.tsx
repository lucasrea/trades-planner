import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { MarketingNav } from "@/components/marketing";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <div className="flex flex-1 items-center px-6 py-16">
        <div className="w-full">
          <AuthForm mode="login" />
          <p className="mt-4 text-center text-sm text-muted">
            No account?{" "}
            <Link href="/signup" className="font-medium text-ink underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
