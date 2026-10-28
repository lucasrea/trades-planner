import Link from "next/link";
import { googleSignInAction } from "@/lib/actions/auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const authErrors: Record<string, string> = {
  Configuration: "Google sign-in isn’t set up on this machine yet.",
  AccessDenied: "Google sign-in was cancelled.",
  OAuthAccountNotLinked: "That Google account couldn’t be linked. Try again.",
  Default: "Couldn’t sign in with Google. Try again.",
};

export function GoogleAuthCard({
  mode,
  next,
  error,
}: {
  mode: "login" | "signup";
  next?: string;
  error?: string;
}) {
  const message = error ? authErrors[error] || authErrors.Default : null;

  return (
    <div className="card mx-auto w-full max-w-md space-y-5 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Log in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "Use the Google account for this business."
            : "One Google account per business. You’ll set rates and GST/HST next."}
        </p>
      </div>
      {message ? <p className="text-sm text-accent">{message}</p> : null}
      <form action={googleSignInAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <GoogleSignInButton
          label={mode === "login" ? "Continue with Google" : "Sign up with Google"}
        />
      </form>
      <p className="text-center text-xs text-muted">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-ink underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-ink underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
