"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked:
      "This email is registered with a password. Please sign in with email instead.",
    CredentialsSignin: "Invalid email or password.",
    default: "Something went wrong. Please try again.",
  };

  const [error, setError] = useState(
    urlError ? (errorMessages[urlError] ?? errorMessages.default) : "",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else if (res?.ok) {
      window.location.href = "/api/auth/post-login";
    }
  }

  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col justify-center px-6">
      <div className="w-full max-w-sm mx-auto space-y-8">
        {/* Logo + heading */}
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center mb-6">
            <span className="font-barlow font-black text-xl text-sp-accent">
              SP
            </span>
          </div>
          <h1 className="font-barlow font-extrabold text-[38px] leading-none tracking-tight">
            Welcome
            <br />
            back.
          </h1>
          <p className="text-sp-muted text-sm font-light">
            Sign in to continue your training.
          </p>
        </div>

        {/* Google — callbackUrl points to post-login router */}
        <button
          onClick={() =>
            signIn("google", { callbackUrl: "/api/auth/post-login" })
          }
          className="w-full flex items-center justify-center gap-3 bg-sp-surface border border-sp-border rounded-xl py-3.5 text-sm font-medium text-sp-text hover:border-sp-muted transition-colors"
        >
          <Image src="/google.png" alt="google" width={18} height={18} />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-sp-border" />
          <span className="text-[11px] tracking-widest text-sp-muted uppercase">
            or
          </span>
          <div className="flex-1 h-px bg-sp-border" />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widest text-sp-muted">
              Email
            </label>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-sp-surface border border-sp-border rounded-xl px-4 py-3.5 text-sm text-sp-text placeholder:text-sp-muted focus:outline-none focus:border-sp-accent transition-colors"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widest text-sp-muted">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-sp-surface border border-sp-border rounded-xl px-4 py-3.5 text-sm text-sp-text placeholder:text-sp-muted focus:outline-none focus:border-sp-accent transition-colors"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="text-[12px] text-sp-muted hover:text-sp-accent transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-xl py-4 transition-opacity hover:opacity-85 disabled:opacity-50 mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-sp-muted">
          No account?{" "}
          <a
            href="/register"
            className="text-sp-accent font-medium hover:underline"
          >
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
