"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

//  Types

type Answers = {
  primaryGoal: string;
  trainingLocation: string;
  biologicalSex: string;
  experienceLevel: string;
};

//  Option card component

function OptionCard({
  label,
  sublabel,
  emoji,
  selected,
  onClick,
}: {
  label: string;
  sublabel?: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-5 border transition-all duration-150 active:scale-[0.98] ${
        selected
          ? "bg-sp-accent/10 border-sp-accent"
          : "bg-sp-surface border-sp-border hover:border-sp-accent/40"
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-3xl">{emoji}</span>
        <div>
          <p
            className={`font-barlow font-bold text-lg tracking-wide ${
              selected ? "text-sp-accent" : "text-sp-text"
            }`}
          >
            {label}
          </p>
          {sublabel && (
            <p className="text-sm text-sp-muted mt-0.5">{sublabel}</p>
          )}
        </div>
        {/* Selection indicator */}
        <div className="ml-auto">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selected ? "border-sp-accent bg-sp-accent" : "border-sp-border"
            }`}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-sp-bg" />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Progress bar ──────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < step ? "bg-sp-accent" : "bg-sp-surface"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

const TOTAL_STEPS = 5;

export default function OnboardPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({
    primaryGoal: "",
    trainingLocation: "",
    biologicalSex: "",
    experienceLevel: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === 1) return !!answers.primaryGoal;
    if (step === 2) return !!answers.trainingLocation;
    if (step === 3) return !!answers.biologicalSex;
    if (step === 4) return !!answers.experienceLevel;
    return true;
  }

  async function handleComplete() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      // Refresh JWT token so middleware sees onboardingComplete: true
      await updateSession({ onboardingComplete: true, isNewUser: false });

      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Goal label helpers for confirm screen ─────────────────────
  const goalLabel: Record<string, string> = {
    LOSE_WEIGHT: "Lose Weight",
    BUILD_MUSCLE: "Build Muscle",
    GET_FIT: "Get Fit",
  };
  const locationLabel: Record<string, string> = {
    HOME: "Home",
    GYM: "Gym",
  };
  const sexLabel: Record<string, string> = {
    MALE: "Male",
    FEMALE: "Female",
    NOT_SPECIFIED: "Prefer not to say",
  };
  const levelLabel: Record<string, string> = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
  };

  return (
    <div className="min-h-screen bg-sp-bg text-sp-text px-5 pt-10 pb-12 flex flex-col max-w-105 mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <ProgressBar step={step} total={TOTAL_STEPS} />
        <p className="text-[11px] text-sp-muted mt-2 tracking-widest uppercase">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>

      {/* ── STEP 1: Primary Goal ────────────────────────────────── */}
      {step === 1 && (
        <div className="flex-1 flex flex-col">
          <div className="mb-8">
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              Let&apos;s personalise your experience
            </p>
            <h1 className="font-barlow font-extrabold text-[36px] leading-tight tracking-tight">
              What&apos;s your{" "}
              <span className="text-sp-accent">main goal?</span>
            </h1>
          </div>
          <div className="space-y-3 flex-1">
            <OptionCard
              emoji="🔥"
              label="Lose Weight"
              sublabel="Burn fat and improve body composition"
              selected={answers.primaryGoal === "LOSE_WEIGHT"}
              onClick={() => set("primaryGoal", "LOSE_WEIGHT")}
            />
            <OptionCard
              emoji="💪"
              label="Build Muscle"
              sublabel="Increase strength and muscle mass"
              selected={answers.primaryGoal === "BUILD_MUSCLE"}
              onClick={() => set("primaryGoal", "BUILD_MUSCLE")}
            />
            <OptionCard
              emoji="⚡"
              label="Get Fit"
              sublabel="Improve overall fitness and endurance"
              selected={answers.primaryGoal === "GET_FIT"}
              onClick={() => set("primaryGoal", "GET_FIT")}
            />
          </div>
        </div>
      )}

      {/* ── STEP 2: Training Location ───────────────────────────── */}
      {step === 2 && (
        <div className="flex-1 flex flex-col">
          <div className="mb-8">
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              We&apos;ll match plans to your setup
            </p>
            <h1 className="font-barlow font-extrabold text-[36px] leading-tight tracking-tight">
              Where do you <span className="text-sp-accent">train?</span>
            </h1>
          </div>
          <div className="space-y-3 flex-1">
            <OptionCard
              emoji="🏠"
              label="Home"
              sublabel="Bodyweight and home equipment"
              selected={answers.trainingLocation === "HOME"}
              onClick={() => set("trainingLocation", "HOME")}
            />
            <OptionCard
              emoji="🏋️"
              label="Gym"
              sublabel="Full equipment access"
              selected={answers.trainingLocation === "GYM"}
              onClick={() => set("trainingLocation", "GYM")}
            />
          </div>
        </div>
      )}

      {/* ── STEP 3: Biological Sex ──────────────────────────────── */}
      {step === 3 && (
        <div className="flex-1 flex flex-col">
          <div className="mb-8">
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              Used for training recommendations
            </p>
            <h1 className="font-barlow font-extrabold text-[36px] leading-tight tracking-tight">
              Biological <span className="text-sp-accent">sex?</span>
            </h1>
          </div>
          <div className="space-y-3 flex-1">
            <OptionCard
              emoji="♂️"
              label="Male"
              selected={answers.biologicalSex === "MALE"}
              onClick={() => set("biologicalSex", "MALE")}
            />
            <OptionCard
              emoji="♀️"
              label="Female"
              selected={answers.biologicalSex === "FEMALE"}
              onClick={() => set("biologicalSex", "FEMALE")}
            />
            <OptionCard
              emoji="⭕"
              label="Prefer not to say"
              selected={answers.biologicalSex === "NOT_SPECIFIED"}
              onClick={() => set("biologicalSex", "NOT_SPECIFIED")}
            />
          </div>
        </div>
      )}

      {/* ── STEP 4: Experience Level ────────────────────────────── */}
      {step === 4 && (
        <div className="flex-1 flex flex-col">
          <div className="mb-8">
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              We&apos;ll set the right intensity
            </p>
            <h1 className="font-barlow font-extrabold text-[36px] leading-tight tracking-tight">
              Your <span className="text-sp-accent">experience</span> level?
            </h1>
          </div>
          <div className="space-y-3 flex-1">
            <OptionCard
              emoji="🌱"
              label="Beginner"
              sublabel="Less than 1 year of consistent training"
              selected={answers.experienceLevel === "BEGINNER"}
              onClick={() => set("experienceLevel", "BEGINNER")}
            />
            <OptionCard
              emoji="📈"
              label="Intermediate"
              sublabel="1–3 years, comfortable with the basics"
              selected={answers.experienceLevel === "INTERMEDIATE"}
              onClick={() => set("experienceLevel", "INTERMEDIATE")}
            />
            <OptionCard
              emoji="🏆"
              label="Advanced"
              sublabel="3+ years, training is a lifestyle"
              selected={answers.experienceLevel === "ADVANCED"}
              onClick={() => set("experienceLevel", "ADVANCED")}
            />
          </div>
        </div>
      )}

      {/* ── STEP 5: Confirm ─────────────────────────────────────── */}
      {step === 5 && (
        <div className="flex-1 flex flex-col">
          <div className="mb-8">
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              You&apos;re all set
            </p>
            <h1 className="font-barlow font-extrabold text-[36px] leading-tight tracking-tight">
              Here&apos;s your <span className="text-sp-accent">profile.</span>
            </h1>
          </div>

          {/* Summary card */}
          <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-4 flex-1">
            {[
              {
                label: "Goal",
                value: goalLabel[answers.primaryGoal] ?? "—",
                emoji: "🎯",
              },
              {
                label: "Location",
                value: locationLabel[answers.trainingLocation] ?? "—",
                emoji: "📍",
              },
              {
                label: "Biological Sex",
                value: sexLabel[answers.biologicalSex] ?? "—",
                emoji: "👤",
              },
              {
                label: "Experience",
                value: levelLabel[answers.experienceLevel] ?? "—",
                emoji: "📊",
              },
            ].map(({ label, value, emoji }) => (
              <div
                key={label}
                className="flex items-center justify-between py-3 border-b border-sp-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{emoji}</span>
                  <p className="text-sm text-sp-muted">{label}</p>
                </div>
                <p className="font-barlow font-bold text-base text-sp-text">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
          )}
        </div>
      )}

      {/* ── Navigation ──────────────────────────────────────────── */}
      <div className="mt-8 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-none px-5 py-4 rounded-2xl border border-sp-border text-sp-muted font-barlow font-bold text-base tracking-wide hover:border-sp-accent/40 transition-colors"
          >
            ←
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex-1 bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={submitting}
            className="flex-1 bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : "▶ Let's Go"}
          </button>
        )}
      </div>
    </div>
  );
}
