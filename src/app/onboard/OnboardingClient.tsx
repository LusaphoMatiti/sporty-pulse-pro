"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";

type Equipment = { id: string; name: string; category: string };
type Grouped = {
  fullbody: Equipment[];
  upper: Equipment[];
  lower: Equipment[];
  core: Equipment[];
};

type FitnessLevel = "beginner" | "intermediate" | "advanced";

const CATEGORIES = [
  { key: "fullbody", label: "Full body" },
  { key: "upper", label: "Upper body" },
  { key: "lower", label: "Lower body" },
  { key: "core", label: "Core" },
] as const;

const LEVELS: { key: FitnessLevel; label: string; description: string }[] = [
  {
    key: "beginner",
    label: "Beginner",
    description: "New to training or returning after a long break",
  },
  {
    key: "intermediate",
    label: "Intermediate",
    description: "Training consistently for 6+ months",
  },
  {
    key: "advanced",
    label: "Advanced",
    description: "2+ years of structured training",
  },
];

export default function OnboardingClient({ grouped }: { grouped: Grouped }) {
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = useState<"path" | "category" | "item" | "level">(
    "path",
  );
  const [category, setCategory] = useState<keyof Grouped | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<FitnessLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [muscleGroup, setMuscleGroup] = useState<keyof Grouped | null>(null);

  async function complete(equipmentId: string | null, source: string) {
    setLoading(true);
    try {
      // 1. Save onboarding data to DB
      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId,
          source,
          level: selectedLevel?.toUpperCase(),
          muscleGroup: muscleGroup ?? "fullbody",
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        console.error("onboarding error:", body);
        setLoading(false);
        return;
      }

      // 2. Refresh the JWT so middleware sees onboardingComplete = true
      await update({ onboardingComplete: true });

      // 3. Navigate to training
      router.push("/training");
    } catch (err) {
      console.error("fetch failed:", err);
      setLoading(false);
    }
  }

  // ── Fitness level step ────────────────────────────────────────────────────
  if (step === "level") {
    return (
      <div className="relative min-h-screen w-full overflow-hidden font-dm">
        <Image
          src="/onboarding.jpg"
          alt="Choose your level"
          fill
          priority
          className="object-cover object-[center_right]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/85 to-black/30" />

        <div className="relative z-10 min-h-screen flex flex-col justify-end pb-10 px-5">
          <div className="mb-8 space-y-2">
            <p className="text-[11px] tracking-widest text-sp-accent uppercase">
              {selectedId ? "Step 3 of 3" : "Last step"}
            </p>
            <h1 className="font-barlow font-extrabold text-[42px] leading-none text-white tracking-tight">
              Choose your
              <br />
              <span className="text-sp-accent">training level.</span>
            </h1>
            <p className="text-white/50 text-sm font-light">
              We&apos;ll tailor your programs to match your experience.
            </p>
          </div>

          <div className="space-y-3">
            {LEVELS.map(({ key, label, description }) => {
              const isSelected = selectedLevel === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedLevel(key)}
                  className={`w-full flex items-center justify-between rounded-2xl px-5 py-4 border transition-all text-left
                    ${
                      isSelected
                        ? "bg-sp-accent border-sp-accent"
                        : "bg-white/8 border-white/12 hover:bg-white/12"
                    }`}
                >
                  <div>
                    <p
                      className={`font-barlow font-bold text-xl tracking-wide ${isSelected ? "text-sp-bg" : "text-white"}`}
                    >
                      {label}
                    </p>
                    <p
                      className={`text-sm font-light mt-0.5 ${isSelected ? "text-sp-bg/70" : "text-white/50"}`}
                    >
                      {description}
                    </p>
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isSelected ? "text-sp-bg" : "text-white/40"}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              );
            })}

            <button
              onClick={() =>
                selectedLevel &&
                complete(selectedId, selectedId ? "declared" : "bodyweight")
              }
              disabled={!selectedLevel || loading}
              className="w-full bg-white text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-2xl py-4 mt-2 hover:opacity-85 transition-opacity disabled:opacity-30"
            >
              {loading ? "Setting up..." : "Start Training"}
            </button>

            <button
              onClick={() => setStep(selectedId ? "item" : "path")}
              className="text-sm text-white/40 hover:text-white transition-colors w-full text-center pt-1"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Steps 1–3 ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col justify-center px-6">
      <div className="w-full max-w-sm mx-auto space-y-8">
        <div className="w-12 h-12 rounded-2xl bg-sp-accent/10 border border-sp-accent/25 flex items-center justify-center">
          <span className="font-barlow font-black text-xl text-sp-accent">
            SP
          </span>
        </div>

        {/* ── Path selection ── */}
        {step === "path" && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] tracking-widest text-sp-muted uppercase">
                Setup
              </p>
              <h1 className="font-barlow font-extrabold text-[36px] leading-none tracking-tight">
                What do you
                <br />
                train with?
              </h1>
              <p className="text-sp-muted text-sm font-light pt-1">
                We&apos;ll build your program around your equipment.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setStep("category")}
                className="w-full text-left bg-sp-surface border border-sp-border rounded-2xl p-4 hover:border-sp-accent transition-colors"
              >
                <p className="font-barlow font-bold text-base">
                  I have my own equipment
                </p>
                <p className="text-sp-muted text-xs mt-0.5">
                  Select from our equipment list
                </p>
              </button>

              <button
                onClick={() => {
                  setMuscleGroup("fullbody");
                  setStep("level");
                }}
                disabled={loading}
                className="w-full text-left bg-sp-surface border border-sp-border rounded-2xl p-4 hover:border-sp-muted transition-colors"
              >
                <p className="font-barlow font-bold text-base">
                  I don&apos;t have equipment yet
                </p>
                <p className="text-sp-muted text-xs mt-0.5">
                  Start with bodyweight · unlock more later
                </p>
              </button>
            </div>
          </>
        )}

        {/* ── Category ── */}
        {step === "category" && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] tracking-widest text-sp-muted uppercase">
                Step 1 of 3
              </p>
              <h1 className="font-barlow font-extrabold text-[36px] leading-none tracking-tight">
                Choose a<br />
                category
              </h1>
            </div>

            <div className="space-y-3">
              {CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setCategory(key);
                    setMuscleGroup(key);
                    setStep("item");
                  }}
                  className="w-full text-left bg-sp-surface border border-sp-border rounded-2xl p-4 hover:border-sp-accent transition-colors"
                >
                  <p className="font-barlow font-bold text-base">{label}</p>
                  <p className="text-sp-muted text-xs mt-0.5">
                    {grouped[key].length} items available
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep("path")}
              className="text-sm text-sp-muted hover:text-sp-text transition-colors"
            >
              ← Back
            </button>
          </>
        )}

        {/* ── Item selection ── */}
        {step === "item" && category && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] tracking-widest text-sp-muted uppercase">
                Step 2 of 3
              </p>
              <h1 className="font-barlow font-extrabold text-[36px] leading-none tracking-tight">
                Select your
                <br />
                equipment
              </h1>
            </div>

            <div className="space-y-2">
              {grouped[category].map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => setSelectedId(eq.id)}
                  className={`w-full text-left bg-sp-surface border rounded-2xl p-4 transition-colors ${
                    selectedId === eq.id
                      ? "border-sp-accent"
                      : "border-sp-border hover:border-sp-muted"
                  }`}
                >
                  <p className="font-barlow font-bold text-base">{eq.name}</p>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => selectedId && setStep("level")}
                disabled={!selectedId}
                className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-xl py-4 hover:opacity-85 transition-opacity disabled:opacity-40"
              >
                Continue
              </button>

              <button
                onClick={() => setStep("category")}
                className="text-sm text-sp-muted hover:text-sp-text transition-colors w-full text-center"
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
