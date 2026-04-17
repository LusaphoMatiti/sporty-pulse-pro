"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanStub = {
  id: string;
  name: string;
  description: string;
  tier: string;
  muscleGroup: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  equipment?: { name: string } | null;
};

type Props = {
  plan: PlanStub;
  isActive?: boolean;
};

const muscleGroupLabel: Record<string, string> = {
  FULLBODY: "Full Body",
  UPPER: "Upper Body",
  LOWER: "Lower Body",
  CORE: "Core",
};

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

const levelMeta: {
  value: Level;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    value: "BEGINNER",
    label: "Beginner",
    description: "Lower volume, longer rest. Best if you're just starting out.",
    emoji: "🌱",
  },
  {
    value: "INTERMEDIATE",
    label: "Intermediate",
    description: "Balanced sets and rest. You've been training for 6+ months.",
    emoji: "⚡",
  },
  {
    value: "ADVANCED",
    label: "Advanced",
    description: "High volume, short rest. You train consistently and hard.",
    emoji: "🔥",
  },
];

export default function ProgramCard({ plan, isActive = false }: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Level>("BEGINNER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/programs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, level: selectedLevel }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      router.push("/training");
    } catch {
      setError("Network error, please try again");
      setLoading(false);
    }
  };

  return (
    <>
      {/*  Card  */}
      <div
        className="relative bg-sp-surface border border-sp-border rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
        onClick={() => !isActive && setSheetOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && !isActive && setSheetOpen(true)}
        aria-label={`Start ${plan.name}`}
      >
        <div className="px-4 pt-4 pb-3">
          {/* Tier badge + muscle group */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-widest text-sp-muted uppercase">
              {muscleGroupLabel[plan.muscleGroup] ?? plan.muscleGroup}
            </span>
            <div className="flex items-center gap-2">
              {isActive && (
                <span className="bg-sp-accent/15 border border-sp-accent/30 text-sp-accent text-[10px] font-medium rounded-lg px-2 py-1">
                  Active
                </span>
              )}
              <span className="bg-sp-accent/10 border border-sp-accent/20 text-sp-accent text-[10px] font-medium rounded-lg px-2 py-1">
                {plan.equipment ? "Equipment" : "Bodyweight"}
              </span>
            </div>
          </div>

          {/* Name */}
          <h3 className="font-barlow font-extrabold text-[20px] leading-tight tracking-tight mb-1">
            {plan.name}
          </h3>

          {/* Description */}
          <p className="text-[12px] text-sp-muted2 line-clamp-2 mb-3">
            {plan.description}
          </p>

          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-sp-surface2 rounded-xl px-3 py-2 text-center">
              <p className="font-barlow font-bold text-base">
                {plan.durationWeeks}w
              </p>
              <p className="text-[10px] text-sp-muted uppercase tracking-wide">
                Duration
              </p>
            </div>
            <div className="flex-1 bg-sp-surface2 rounded-xl px-3 py-2 text-center">
              <p className="font-barlow font-bold text-base">
                {plan.sessionsPerWeek}x
              </p>
              <p className="text-[10px] text-sp-muted uppercase tracking-wide">
                Per Week
              </p>
            </div>
            {plan.equipment && (
              <div className="flex-1 bg-sp-surface2 rounded-xl px-3 py-2 text-center">
                <p className="font-barlow font-bold text-base truncate">
                  {plan.equipment.name}
                </p>
                <p className="text-[10px] text-sp-muted uppercase tracking-wide">
                  Equipment
                </p>
              </div>
            )}
          </div>

          {/* Start CTA row */}
          <div className="mt-3 flex items-center justify-between">
            {isActive ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/training");
                }}
                className="w-full bg-sp-accent/10 border border-sp-accent/20 text-sp-accent font-barlow font-bold text-[12px] tracking-widest uppercase rounded-xl py-2.5 hover:bg-sp-accent/15 transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetOpen(true);
                }}
                className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-[12px] tracking-widest uppercase rounded-xl py-2.5 hover:opacity-85 active:scale-[0.98] transition-all"
              >
                Start Program →
              </button>
            )}
          </div>
        </div>
      </div>

      {/*  Level picker bottom sheet  */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-sp-surface border border-sp-border rounded-t-3xl px-5 pt-5 pb-10 animate-slide-up"
            style={{ maxHeight: "90dvh", overflowY: "auto" }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-sp-border mx-auto mb-5" />

            {/* Header */}
            <p className="text-[10px] tracking-widest text-sp-muted uppercase text-center mb-1">
              Starting
            </p>
            <h2 className="font-barlow font-extrabold text-[24px] leading-tight tracking-tight text-center mb-1">
              {plan.name}
            </h2>
            <p className="text-[12px] text-sp-muted2 text-center mb-6">
              Choose your training level to personalise sets and reps.
            </p>

            {/* Level options */}
            <div className="space-y-2.5 mb-6">
              {levelMeta.map((lvl) => {
                const selected = selectedLevel === lvl.value;
                return (
                  <button
                    key={lvl.value}
                    onClick={() => setSelectedLevel(lvl.value)}
                    className={`w-full text-left rounded-2xl border px-4 py-3.5 transition-all ${
                      selected
                        ? "bg-sp-accent/10 border-sp-accent/40"
                        : "bg-sp-bg border-sp-border hover:border-sp-accent/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{lvl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold ${selected ? "text-sp-accent" : "text-sp-text"}`}
                        >
                          {lvl.label}
                        </p>
                        <p className="text-[11px] text-sp-muted leading-snug mt-0.5">
                          {lvl.description}
                        </p>
                      </div>
                      {/* Radio indicator */}
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected
                            ? "border-sp-accent bg-sp-accent"
                            : "border-sp-border"
                        }`}
                      >
                        {selected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-sp-bg" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-red-400 text-center mb-3">
                {error}
              </p>
            )}

            {/* Confirm CTA */}
            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-xl tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98] mb-2 disabled:opacity-50"
            >
              {loading ? "Starting…" : "Start Program"}
            </button>

            <button
              onClick={() => setSheetOpen(false)}
              className="w-full text-center text-[12px] font-barlow font-bold text-sp-muted uppercase tracking-wider py-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
