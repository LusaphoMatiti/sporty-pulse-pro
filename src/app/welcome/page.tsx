"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

export default function WelcomePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const firstName = session?.user?.name?.split(" ")[0] ?? "Athlete";

  async function handleLetsGo() {
    setLoading(true);
    try {
      // 1. Clear isNewUser in the DB
      await fetch("/api/auth/complete-welcome", { method: "POST" });

      // 2. Refresh the JWT so middleware sees isNewUser = false
      await update({ isNewUser: false });

      // 3. Send to onboarding
      router.push("/onboard");
    } catch (err) {
      console.error("complete-welcome failed:", err);
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white font-dm">
      <Image
        src="/inbound.jpg"
        alt="Welcome background"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-b from-black/95 via-black/60 to-black/80" />

      <div className="relative z-10 min-h-screen flex flex-col justify-between px-6 pt-16 pb-10">
        <div className="w-full max-w-sm mx-auto flex flex-col justify-between min-h-[calc(100vh-6.5rem)]">
          <div className="space-y-8">
            <div className="w-12 h-12 rounded-2xl bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center">
              <span className="font-barlow font-black text-xl text-sp-accent">
                SP
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] tracking-widest text-sp-accent uppercase">
                Account created
              </p>
              <h1 className="font-barlow font-extrabold text-[42px] leading-none tracking-tight">
                Welcome to
                <br />
                <span className="text-sp-accent">Sporty Pulse</span>,<br />
                {firstName}.
              </h1>
              <p className="text-white/60 text-sm font-light pt-1">
                Your training journey starts right now. Let&apos;s build
                something great.
              </p>
            </div>

            <div className="bg-white/8 border border-white/12 rounded-2xl p-5 space-y-4 backdrop-blur-sm">
              <p className="text-[11px] tracking-widest text-white/50 uppercase">
                What&apos;s next
              </p>
              {[
                { step: "01", text: "Pick your equipment" },
                { step: "02", text: "Choose your level" },
                { step: "03", text: "Start your first session" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-center gap-4">
                  <span className="font-barlow font-bold text-sp-accent text-sm w-6">
                    {step}
                  </span>
                  <span className="text-sm text-white/80">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={handleLetsGo}
              disabled={loading}
              className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-2xl py-4 hover:opacity-85 transition-opacity disabled:opacity-50"
            >
              {loading ? "Loading..." : "Let's Go"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
