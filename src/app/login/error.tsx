"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const errors: Record<string, string> = {
  OAuthSignin: "Could not start Google sign-in. Check your OAuth credentials.",
  OAuthCallback: "Google sign-in failed during callback.",
  OAuthAccountNotLinked:
    "This email is already used with a different provider.",
  CredentialsSignin: "Incorrect email or password.",
  Default: "An unexpected error occurred.",
};

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error") ?? "Default";
  const message = errors[error] ?? errors.Default;

  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col justify-center px-6">
      <div className="w-full max-w-sm mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h1 className="font-barlow font-extrabold text-2xl tracking-tight">
          Sign-in Error
        </h1>
        <p className="text-sp-muted text-sm">{message}</p>
        <p className="text-[11px] text-sp-muted/50">Code: {error}</p>
        <a
          href="/login"
          className="inline-block bg-sp-accent text-sp-bg font-barlow font-bold text-base tracking-widest uppercase rounded-xl px-6 py-3 hover:opacity-85 transition-opacity"
        >
          Try Again
        </a>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
