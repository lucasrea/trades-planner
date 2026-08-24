import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { MarketingNav } from "@/components/marketing";

export default function SignupPage() {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingNav />
      <div className="flex flex-1 items-center px-6 py-16">
        <div className="w-full">
          <AuthForm mode="signup" />
          <p className="mt-4 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-ink underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
