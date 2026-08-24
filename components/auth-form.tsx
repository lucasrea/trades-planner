"use client";

import { useActionState } from "react";
import { loginAction, signupAction } from "@/lib/actions/auth";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="card mx-auto w-full max-w-md space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Log in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "Welcome back. Your jobs are on this machine."
            : "Takes a minute. You’ll set rates and GST/HST next."}
        </p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input className="input" type="email" name="email" required autoComplete="email" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Password</span>
        <input
          className="input"
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {state?.error ? <p className="text-sm text-accent">{state.error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Working…" : mode === "login" ? "Log in" : "Continue"}
      </button>
    </form>
  );
}
