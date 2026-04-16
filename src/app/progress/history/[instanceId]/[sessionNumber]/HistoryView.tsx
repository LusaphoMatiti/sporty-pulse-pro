"use client";

import Navbar from "@/components/global/Navbar";
import { useRouter } from "next/navigation";

type ExerciseLog = {
  id: string;
  name: string;
  musclesWorked: string[];
  weightKg: number | null;
  actualReps: number | null;
  actualSets: number | null;
  plannedSets: number;
  plannedReps: number;
};

type Props = {
  meta: {
    planName: string;
    focus: string;
    completedAt: string;
    level: string;
  };
  exercises: ExerciseLog[];
  totalVolume: number;
};

function formatMuscle(raw: string) {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatVolume(kg: number) {
  return `${kg.toLocaleString()}kg`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function completionPercent(e: ExerciseLog) {
  if (!e.actualSets || !e.actualReps) return 0;
  const actual = e.actualSets * e.actualReps;
  const planned = e.plannedSets * e.plannedReps;
  return Math.min(100, Math.round((actual / planned) * 100));
}

export default function HistoryView({ meta, exercises, totalVolume }: Props) {
  const router = useRouter();

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm pb-28 px-5 pt-6 space-y-5 max-w-md mx-auto">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sp-muted text-sm hover:text-sp-text transition-colors"
        >
          ← Back
        </button>

        {/* Header */}
        <div>
          <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
            {formatDate(meta.completedAt)}
          </p>
          <h1 className="font-barlow font-extrabold text-[28px] leading-tight tracking-tight">
            {meta.focus}
          </h1>
          <p className="text-sm text-sp-muted2 mt-1">{meta.planName}</p>
        </div>

        {/* Summary strip */}
        <div className="flex gap-2.5">
          <div className="flex-1 bg-sp-surface border border-sp-border rounded-2xl p-3.5 text-center">
            <p className="text-[10px] tracking-widest text-sp-muted uppercase mb-1">
              Exercises
            </p>
            <p className="font-barlow font-extrabold text-[22px]">
              {exercises.length}
            </p>
          </div>
          <div className="flex-1 bg-sp-surface border border-sp-border rounded-2xl p-3.5 text-center">
            <p className="text-[10px] tracking-widest text-sp-muted uppercase mb-1">
              Volume
            </p>
            <p className="font-barlow font-extrabold text-[22px]">
              {formatVolume(totalVolume)}
            </p>
          </div>
          <div className="flex-1 bg-sp-surface border border-sp-border rounded-2xl p-3.5 text-center">
            <p className="text-[10px] tracking-widest text-sp-muted uppercase mb-1">
              Level
            </p>
            <p className="font-barlow font-extrabold text-[22px] capitalize">
              {meta.level.charAt(0) + meta.level.slice(1).toLowerCase()}
            </p>
          </div>
        </div>

        {/* Exercise list */}
        <section>
          <h2 className="font-barlow font-bold text-xl tracking-wide mb-3">
            Exercises Logged
          </h2>
          <div className="space-y-3">
            {exercises.map((e, i) => {
              const pct = completionPercent(e);
              return (
                <div
                  key={e.id}
                  className="bg-sp-surface border border-sp-border rounded-2xl p-4"
                >
                  {/* Exercise header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-sp-surface2 border border-sp-border flex items-center justify-center font-barlow font-bold text-sm text-sp-muted2 shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="text-[11px] text-sp-muted2 mt-0.5">
                          {e.musclesWorked.map(formatMuscle).join(", ")}
                        </p>
                      </div>
                    </div>
                    <span className="font-barlow font-semibold text-base text-sp-accent shrink-0">
                      {e.actualSets ?? e.plannedSets} ×{" "}
                      {e.actualReps ?? e.plannedReps}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-3 mb-3">
                    {e.weightKg !== null && (
                      <div className="flex-1 bg-sp-surface2 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-sp-muted uppercase tracking-wide mb-0.5">
                          Weight
                        </p>
                        <p className="font-barlow font-bold text-sm">
                          {e.weightKg}kg
                        </p>
                      </div>
                    )}
                    <div className="flex-1 bg-sp-surface2 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-sp-muted uppercase tracking-wide mb-0.5">
                        Planned
                      </p>
                      <p className="font-barlow font-bold text-sm">
                        {e.plannedSets}×{e.plannedReps}
                      </p>
                    </div>
                    <div className="flex-1 bg-sp-surface2 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-sp-muted uppercase tracking-wide mb-0.5">
                        Done
                      </p>
                      <p className="font-barlow font-bold text-sm text-sp-accent">
                        {pct}%
                      </p>
                    </div>
                  </div>

                  {/* Completion bar */}
                  <div className="h-1.5 bg-sp-surface2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sp-accent transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <Navbar />
    </>
  );
}
