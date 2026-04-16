"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Create the account in your database
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }

    // Immediately sign user in after registering
    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInRes?.error) {
      setError("Account created but sign-in failed. Try logging in.");
      return;
    }

    window.location.href = "/welcome";
  }

  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col justify-center px-6">
      <div className="w-full max-w-sm mx-auto space-y-8">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center mb-6">
            <span className="font-barlow font-black text-xl text-sp-accent">
              SP
            </span>
          </div>
          <h1 className="font-barlow font-extrabold text-[38px] leading-none tracking-tight">
            Start your
            <br />
            journey.
          </h1>
          <p className="text-sp-muted text-sm font-light">
            Create your Sporty Pulse account.
          </p>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/welcome" })}
          className="w-full flex items-center justify-center gap-3 bg-sp-surface border border-sp-border rounded-xl py-3.5 text-sm font-medium text-sp-text hover:border-sp-muted transition-colors"
        >
          <Image src="/google.png" alt="google" width={18} height={18} />
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-sp-border" />
          <span className="text-[11px] tracking-widest text-sp-muted uppercase">
            or
          </span>
          <div className="flex-1 h-px bg-sp-border" />
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-widest text-sp-muted">
              Name
            </label>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-sp-surface border border-sp-border rounded-xl px-4 py-3.5 text-sm text-sp-text placeholder:text-sp-muted focus:outline-none focus:border-sp-accent transition-colors"
            />
          </div>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-xl py-4 transition-opacity hover:opacity-85 disabled:opacity-50 mt-2"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-sp-muted">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-sp-accent font-medium hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
