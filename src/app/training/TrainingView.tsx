"use client";
import Navbar from "@/components/global/Navbar";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import type {
  PlanInstance,
  WorkoutPlan,
  PlannedSession,
  Exercise,
  Equipment,
} from "@/generated/prisma";
import type { SessionDraft } from "@/app/api/session/draft/route";

//  Types
type ExerciseForView = {
  id: string;
  order: number;
  sets: number;
  reps: number;
  restSeconds: number;
  exercise: Exercise & { equipment: Equipment | null };
};

/**
 * Tier context for the Training page.
 * FREE (Starter)         — bodyweight only, max 2 programs, no trial
 * DECLARED_TRIAL         — full access temporarily (14 days)
 * PURCHASED (EQUIPMENT)  — bodyweight + purchased-equipment programs
 * PRO                    — everything unlocked
 */
type TrainingTier = "FREE" | "DECLARED_TRIAL" | "PURCHASED" | "PRO";

type ProgramStub = {
  id: string;
  name: string;
  description: string;
  tier: string;
  muscleGroup: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  equipmentId: string | null;
  equipment: { id: string; name: string } | null;
};

type Props = {
  instance: PlanInstance & { plan: WorkoutPlan };
  plannedSession: PlannedSession;
  exercisesForView: ExerciseForView[];
  muscles: string[];
  boughtFromStore?: boolean | null;
  draft?: SessionDraft | null;
  tier?: TrainingTier;
  trialExpiresAt?: string | null;
  /** All available programs in the library (for the programs panel) */
  allPrograms?: ProgramStub[];
  /* Equipment IDs the user currently has active access to */
  activeEquipmentIds?: string[];
};

// ── Helpers ────────────────────────────────────────────────────────
export function weightStorageKey(instanceId: string, sessionNumber: number) {
  return `sp_weights_${instanceId}_${sessionNumber}`;
}

export type WeightMap = Record<string, number | "">;

function formatMuscle(raw: string) {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const muscleGroupLabel: Record<string, string> = {
  FULLBODY: "Full Body",
  UPPER: "Upper Body",
  LOWER: "Lower Body",
  CORE: "Core",
};

const muscleGroupIcon: Record<string, string> = {
  UPPER: "💪",
  LOWER: "🦵",
  CORE: "🔥",
  FULLBODY: "⚡",
};

function getTrialDaysLeft(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Sub-components ─────────────────────────────────────────────────

function TrialWarningBanner({
  trialExpiresAt,
  onUpgrade,
}: {
  trialExpiresAt: string;
  onUpgrade: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const daysLeft = getTrialDaysLeft(trialExpiresAt);
  if (daysLeft <= 0 || daysLeft > 7) return null;

  const urgency = daysLeft <= 2 ? "high" : daysLeft <= 4 ? "medium" : "low";

  const colors = {
    high: {
      bg: "bg-red-500/8",
      border: "border-red-500/20",
      text: "text-red-400",
    },
    medium: {
      bg: "bg-amber-500/8",
      border: "border-amber-500/25",
      text: "text-amber-400",
    },
    low: {
      bg: "bg-sp-accent/8",
      border: "border-sp-accent/20",
      text: "text-sp-accent",
    },
  }[urgency];

  return (
    <div
      className={`relative rounded-2xl border px-4 py-3 flex items-center gap-3 ${colors.bg} ${colors.border}`}
    >
      <span>⏳</span>
      <p className={`text-sm font-medium ${colors.text}`}>
        {daysLeft === 1
          ? "Last day of trial"
          : `${daysLeft} days left in trial`}
        <span className="block text-[11px] opacity-80 mt-0.5">
          Purchase equipment to keep access after trial ends
        </span>
      </p>
      <button
        onClick={onUpgrade}
        className={`shrink-0 font-barlow font-bold text-[11px] uppercase tracking-wider ${colors.text} hover:opacity-75 transition-opacity`}
      >
        Buy →
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2.5 right-2.5 text-sp-muted hover:text-sp-text transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function UpgradeNudgeBanner({ onUpgrade }: { onUpgrade: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative bg-sp-surface border border-sp-accent/20 rounded-2xl px-4 py-3.5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-sp-accent/10 border border-sp-accent/20 flex items-center justify-center text-lg shrink-0">
        🏋️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-sp-text">
          Unlock equipment programs
        </p>
        <p className="text-[12px] text-sp-muted leading-snug mb-2">
          Get access to kettlebell, dumbbell, and barbell programs with
          equipment from Sporty Pulse.
        </p>
        <button
          onClick={onUpgrade}
          className="text-[12px] font-barlow font-bold text-sp-accent uppercase tracking-wider"
        >
          Browse Equipment →
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-sp-muted hover:text-sp-text transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

//  Programs Panel

type LockReason =
  | "equipment_required"
  | "trial_expired"
  | "pro_required"
  | "cap_reached";

function getProgramLockReason(
  program: ProgramStub,
  tier: TrainingTier,
  activeEquipmentIds: string[],
  canStartNew: boolean,
): LockReason | null {
  // PRO: all unlocked
  if (tier === "PRO") return canStartNew ? null : "cap_reached";

  // No equipment required (bodyweight) — accessible to all tiers
  if (!program.equipmentId) return canStartNew ? null : "cap_reached";

  // Has active equipment access (trial or purchased)
  if (activeEquipmentIds.includes(program.equipmentId)) {
    return canStartNew ? null : "cap_reached";
  }

  // Free starter with no trial
  if (tier === "FREE") return "equipment_required";

  // Trial active (but not for this specific equipment)
  if (tier === "DECLARED_TRIAL") return "equipment_required";

  // Purchased but different equipment
  if (tier === "PURCHASED") return "equipment_required";

  return "equipment_required";
}

const lockReasonMeta: Record<
  LockReason,
  { label: string; cta: string; route: string }
> = {
  equipment_required: {
    label: "Equipment required",
    cta: "Get access",
    route: "/store",
  },
  trial_expired: {
    label: "Trial ended",
    cta: "Purchase to unlock",
    route: "/store",
  },
  pro_required: {
    label: "Pro required",
    cta: "Upgrade to Pro",
    route: "/upgrade",
  },
  cap_reached: {
    label: "Program limit reached",
    cta: "Upgrade to Pro",
    route: "/upgrade",
  },
};

function ProgramCard({
  program,
  isActive,
  lockReason,
  onSelect,
  onLockedCta,
}: {
  program: ProgramStub;
  isActive: boolean;
  lockReason: LockReason | null;
  onSelect: () => void;
  onLockedCta: (reason: LockReason) => void;
}) {
  const isLocked = lockReason !== null;

  if (isLocked) {
    return (
      <div className="relative shrink-0 w-70 bg-sp-surface border border-sp-border rounded-2xl overflow-hidden">
        {/* Blurred content */}
        <div
          className="px-4 pt-4 pb-3 select-none pointer-events-none"
          aria-hidden="true"
          style={{ filter: "blur(3px)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] tracking-widest text-sp-muted uppercase">
              {muscleGroupLabel[program.muscleGroup] ?? program.muscleGroup}
            </span>
            <span className="text-[10px] tracking-widest text-sp-muted uppercase">
              {program.tier.charAt(0) + program.tier.slice(1).toLowerCase()}{" "}
              Tier
            </span>
          </div>
          <h3 className="font-barlow font-extrabold text-[18px] leading-tight tracking-tight mb-1">
            {program.name}
          </h3>
          <p className="text-[12px] text-sp-muted line-clamp-2 mb-3">
            {program.description}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-sp-muted2">
            <span>{program.durationWeeks}w Duration</span>
            <span>{program.sessionsPerWeek}x Per Week</span>
          </div>
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-sp-bg/70 backdrop-blur-[2px] px-4 gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-sp-surface border border-sp-border flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-sp-muted"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <span className="text-[10px] tracking-widest text-sp-muted uppercase border border-sp-border rounded-full px-3 py-1">
            {lockReasonMeta[lockReason].label}
          </span>
          <p className="font-barlow font-extrabold text-[15px] tracking-tight text-center px-2">
            {program.name}
          </p>
          <button
            onClick={() => onLockedCta(lockReason)}
            className="w-full max-w-45 bg-sp-accent text-sp-bg font-barlow font-extrabold text-[11px] tracking-widest uppercase rounded-xl py-2.5 hover:opacity-85 active:scale-[0.98] transition-all"
          >
            {lockReasonMeta[lockReason].cta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`shrink-0 w-70 text-left bg-sp-surface border rounded-2xl overflow-hidden transition-all active:scale-[0.98] ${
        isActive
          ? "border-sp-accent ring-1 ring-sp-accent/30"
          : "border-sp-border hover:border-sp-accent/40"
      }`}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] tracking-widest text-sp-muted uppercase">
            {muscleGroupLabel[program.muscleGroup] ?? program.muscleGroup}
          </span>
          {isActive && (
            <span className="text-[10px] tracking-widest text-sp-accent uppercase font-bold">
              ACTIVE
            </span>
          )}
          {!isActive && (
            <span className="text-[10px] tracking-widest text-sp-muted uppercase">
              {program.tier.charAt(0) + program.tier.slice(1).toLowerCase()}{" "}
              Tier
            </span>
          )}
        </div>
        <h3 className="font-barlow font-extrabold text-[18px] leading-tight tracking-tight mb-1">
          {program.name}
        </h3>
        <p className="text-[12px] text-sp-muted line-clamp-2 mb-3">
          {program.description}
        </p>
        <div className="flex items-center gap-3 text-[11px] text-sp-muted2">
          <span>{program.durationWeeks}w Duration</span>
          <span>{program.sessionsPerWeek}x Per Week</span>
        </div>
        {program.equipment && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-sp-accent font-medium">
            <span>🏋️</span>
            {program.equipment.name} Equipment
          </div>
        )}
      </div>

      {/* Tap hint */}
      {isActive && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 text-sp-accent">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-[10px] font-barlow font-bold uppercase tracking-widest">
              View session
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

//  Weight Input Sheet

function WeightInputSheet({
  exercises,
  weights,
  onChange,
  onStart,
  onClose,
}: {
  exercises: ExerciseForView[];
  weights: WeightMap;
  onChange: (id: string, val: number | "") => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md mx-auto bg-sp-bg border border-sp-border rounded-t-3xl px-5 pt-5 pb-10 animate-slide-up"
        style={{ maxHeight: "85dvh", overflowY: "auto" }}
      >
        <div className="mb-5">
          <h2 className="font-barlow font-extrabold text-[24px] leading-tight tracking-tight">
            Set Your Weights
          </h2>
          <p className="text-[12px] text-sp-muted mt-1">
            Enter the weight you&apos;ll use for each weighted exercise.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {exercises
            .filter((e) => e.id in weights)
            .map((e, i) => (
              <div
                key={e.id}
                className="bg-sp-surface border border-sp-border rounded-2xl px-4 py-3.5 flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-sp-surface2 border border-sp-border flex items-center justify-center font-barlow font-bold text-sm text-sp-muted2 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {e.exercise.name}
                  </p>
                  <p className="text-[11px] text-sp-muted2">
                    {e.sets} sets × {e.reps} reps
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    placeholder="0"
                    value={weights[e.id] ?? ""}
                    onChange={(ev) => {
                      const v = ev.target.value;
                      onChange(e.id, v === "" ? "" : parseFloat(v));
                    }}
                    className="w-16 bg-sp-surface2 border border-sp-border rounded-xl text-center text-sm font-barlow font-bold text-sp-text py-2 outline-none focus:border-sp-accent transition-colors"
                  />
                  <span className="text-[11px] text-sp-muted2 font-medium">
                    kg
                  </span>
                </div>
              </div>
            ))}
        </div>

        <p className="text-[11px] text-sp-muted text-center mb-4">
          Weights are saved and used to calculate your training volume on the
          Progress page.
        </p>

        <button
          className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-xl tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98]"
          onClick={onStart}
        >
          ▶ Start Workout
        </button>

        <button
          onClick={onStart}
          className="w-full text-center text-[12px] font-barlow font-bold text-sp-muted uppercase tracking-wider py-3 mt-1"
        >
          Skip weight entry
        </button>
      </div>
    </div>
  );
}

//  Session Detail Panel
// Shown when a program is selected — slides up to show exercises for the current session.

function SessionDetailPanel({
  instance,
  exercisesForView,
  muscles,
  tier,
  weights,
  hasDraft,
  draftProgress,
  currentSession,
  level,
  onStartNow,
  allPrograms,
  activeEquipmentIds,
}: {
  instance: PlanInstance & { plan: WorkoutPlan };
  plannedSession: PlannedSession;
  exercisesForView: ExerciseForView[];
  muscles: string[];
  boughtFromStore?: boolean | null;
  tier: TrainingTier;
  weights: WeightMap;
  hasDraft: boolean;
  draftProgress: string | null;
  currentSession: number;
  level: string;
  onStartNow: () => void;
  onBack: () => void;
  allPrograms: ProgramStub[];
  activeEquipmentIds: string[];
}) {
  const router = useRouter();
  const { plan } = instance;
  const firstEquipment = exercisesForView.find((e) => e.exercise.equipment)
    ?.exercise.equipment;
  const titleLeft = plan.name.split(" ")[0];
  const titleRight = muscleGroupLabel[plan.muscleGroup] ?? plan.muscleGroup;

  // Determine if user can start a new program (simplified logic, ideally passed from parent)
  const canStartNew = tier === "PRO";

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    plan.id,
  );

  return (
    <div className="space-y-6">
      {/* Session header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-barlow font-extrabold text-[26px] leading-tight tracking-tight">
            {titleLeft} <span className="text-sp-accent">·</span>{" "}
            <span className="text-sp-accent">{titleRight}</span>
          </h2>
        </div>
      </div>

      {/* Video placeholder */}
      <div className="relative w-full aspect-video bg-sp-surface rounded-2xl border border-sp-border overflow-hidden flex items-center justify-center">
        <span className="absolute top-3 left-3 text-[11px] tracking-widest text-sp-muted2 bg-sp-bg/75 border border-sp-border backdrop-blur rounded-lg px-2.5 py-1">
          DEMO
        </span>
        <video
          muted
          preload="metadata"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <button className="w-14 h-14 rounded-full bg-sp-accent flex items-center justify-center">
            <span className="text-sp-bg text-xl ml-1">▶</span>
          </button>
          <p className="text-[12px] text-sp-muted">
            Form demonstration · 2 min
          </p>
        </div>
      </div>

      {/* Equipment strip */}
      {firstEquipment && (
        <div className="flex items-center gap-3 bg-sp-accent/10 border border-sp-accent/25 rounded-xl px-6 py-4">
          <Image
            className="bg-white p-1 rounded-full"
            src="/gym.png"
            alt="icon"
            width={30}
            height={30}
          />
          <div className="flex items-center space-x-2">
            <p className="text-sm">
              <span className="text-sp-accent font-medium">
                {firstEquipment.name}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Target muscles */}
      <div>
        <h3 className="font-barlow font-bold text-lg tracking-wide mb-2.5">
          Target Muscles
        </h3>
        <div className="flex flex-wrap gap-2">
          {muscles.map((m) => (
            <div
              key={m}
              className="flex items-center gap-2 bg-sp-surface border border-sp-border rounded-full px-3 py-1.5 text-[12px] text-sp-muted2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sp-accent" />
              {formatMuscle(m)}
            </div>
          ))}
        </div>
      </div>

      {/* Exercises card */}
      <div className="bg-sp-surface border border-sp-border rounded-2xl p-5">
        {/*  Programs section  */}
        <section className="mt-8 pb-10 ">
          <div className="flex items-center justify-between mb-3 ">
            <h2 className="font-barlow font-bold text-xl tracking-wide">
              Program
            </h2>
            {allPrograms.length > 0 && (
              <span className="text-[11px] text-sp-muted2">
                {allPrograms.length} available
              </span>
            )}
          </div>

          {allPrograms.length > 0 ? (
            /* Horizontally scrollable program cards — only this strip scrolls */
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-5 px-5 snap-x snap-mandatory scrollbar-none ">
              {allPrograms.map((program) => {
                const lockReason = getProgramLockReason(
                  program,
                  tier,
                  activeEquipmentIds,
                  canStartNew,
                );
                return (
                  <ProgramCard
                    key={program.id}
                    program={program}
                    isActive={program.id === plan.id}
                    lockReason={lockReason}
                    onSelect={() => setSelectedProgramId(program.id)}
                    onLockedCta={(reason) => {
                      if (
                        reason === "cap_reached" ||
                        reason === "pro_required"
                      ) {
                        router.push("/upgrade");
                      } else {
                        router.push("/store");
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : (
            /* Fallback: show current program info as a simple card */
            <div className="bg-sp-surface border border-sp-border rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sp-accent/10 border border-sp-accent/20 flex items-center justify-center text-xl shrink-0">
                {muscleGroupIcon[plan.muscleGroup] ?? "⚡"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sp-text truncate">
                  {plan.name}
                </p>
                <p className="text-[11px] text-sp-muted2">
                  {muscleGroupLabel[plan.muscleGroup] ?? plan.muscleGroup} · Day{" "}
                  {currentSession}
                </p>
              </div>
              <span className="text-[11px] text-sp-muted2 bg-sp-surface2 border border-sp-border rounded-lg px-2.5 py-1 shrink-0">
                Active
              </span>
            </div>
          )}
          {/* Back button */}
          <button
            onClick={() => router.push("/programs")}
            className="flex items-center gap-1.5 text-sp-muted text-sm hover:text-sp-text transition-colors mt-2"
          >
            ← All Programs
          </button>
        </section>
        <div className="divide-y divide-sp-border" />
        <div className="flex items-center justify-between  mb-4">
          <h3 className="font-barlow font-bold text-[20px] tracking-wide">
            Exercises
          </h3>
          <span className="text-[11px] text-sp-muted2 bg-sp-surface2 border border-sp-border rounded-lg px-2.5 py-1">
            {level.charAt(0) + level.slice(1).toLowerCase()}
          </span>
        </div>

        <div className="divide-y divide-sp-border">
          {exercisesForView.map((e, i) => (
            <div key={e.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-sp-surface2 border border-sp-border flex items-center justify-center font-barlow font-bold text-sm text-sp-muted2">
                  {i + 1}
                </div>
                <div>
                  <span className="text-sm font-medium">{e.exercise.name}</span>
                  {e.exercise.equipment !== null &&
                    weights[e.id] !== "" &&
                    weights[e.id] !== undefined && (
                      <p className="text-[11px] text-sp-accent">
                        {weights[e.id]}kg planned
                      </p>
                    )}
                </div>
              </div>
              <span className="font-barlow font-semibold text-base text-sp-accent">
                {e.sets} × {e.reps}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resume banner */}
      {hasDraft && (
        <div className="bg-sp-accent/10 border border-sp-accent/25 rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏸</span>
            <div>
              <p className="text-sm font-semibold text-sp-text">
                Workout in progress
              </p>
              <p className="text-[12px] text-sp-muted mt-0.5">
                {draftProgress}
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              router.push(`/workout/${instance.id}/${currentSession}`)
            }
            className="bg-sp-accent text-sp-bg font-barlow font-extrabold text-[13px] tracking-widest uppercase rounded-xl px-4 py-2.5 shrink-0 hover:opacity-85 transition-opacity"
          >
            Resume →
          </button>
        </div>
      )}

      {/* CTA */}
      <button
        className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-xl tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98]"
        onClick={onStartNow}
      >
        {hasDraft ? "↺ Restart Session" : "▶ Start Now"}
      </button>
    </div>
  );
}

// Main View

export default function TrainingView({
  instance,
  plannedSession,
  exercisesForView,
  muscles,
  boughtFromStore,
  draft,
  tier = "FREE",
  trialExpiresAt,
  allPrograms = [],
  activeEquipmentIds = [],
}: Props) {
  const router = useRouter();
  const { plan, currentSession, level } = instance;

  const hasDraft = draft != null && draft.sessionNumber === currentSession;
  const draftProgress = hasDraft
    ? `${draft.currentExerciseIdx} of ${exercisesForView.length} exercises done`
    : null;

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    plan.id,
  );

  const [showWeightSheet, setShowWeightSheet] = useState(false);
  const [weights, setWeights] = useState<WeightMap>(() => {
    const base = Object.fromEntries(
      exercisesForView
        .filter(
          (e) =>
            e.exercise.equipment !== null &&
            e.exercise.equipment?.name &&
            e.exercise.equipment.name.toLowerCase() !== "bodyweight",
        )
        .map((e) => [e.id, "" as number | ""]),
    );
    try {
      const stored = localStorage.getItem(
        weightStorageKey(instance.id, currentSession),
      );
      if (stored) return { ...base, ...JSON.parse(stored) };
    } catch {}
    return base;
  });

  const handleWeightChange = (id: string, val: number | "") => {
    setWeights((prev) => ({ ...prev, [id]: val }));
  };

  const weightedExercises = exercisesForView.filter((e) => e.id in weights);

  const handleStartNow = () => {
    if (weightedExercises.length > 0) {
      setShowWeightSheet(true);
    } else {
      router.push(`/workout/${instance.id}/${instance.currentSession}`);
    }
  };

  const handleConfirmStart = () => {
    try {
      const cleaned: WeightMap = {};
      for (const [id, v] of Object.entries(weights)) {
        cleaned[id] = v === "" ? 0 : v;
      }
      localStorage.setItem(
        weightStorageKey(instance.id, currentSession),
        JSON.stringify(cleaned),
      );
    } catch {}
    setShowWeightSheet(false);
    router.push(`/workout/${instance.id}/${instance.currentSession}`);
  };

  const isFreeStarter = tier === "FREE";
  const isActiveTrial = tier === "DECLARED_TRIAL";

  // Whether showing the session detail of the active (current) program
  const isViewingActiveProgram = selectedProgramId === plan.id;

  //  Determine cap for new programs
  // FREE / EQUIPMENT: max 2 active programs
  // PRO: unlimited

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm pb-28 px-5 pt-6 space-y-4 max-w-md mx-auto">
        {/*  Page header  */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[11px] tracking-widest text-sp-muted uppercase ">
                Day {currentSession} · {plannedSession.focus}
              </p>
            </div>
          </div>
          {/* Tier badge */}
          <span
            className={`mt-1.5 inline-block text-[10px] font-barlow font-bold tracking-widest uppercase border rounded-lg px-2.5 py-1 ${
              tier === "PRO"
                ? "bg-sp-accent/10 border-sp-accent/20 text-sp-accent"
                : tier === "PURCHASED"
                  ? "bg-sp-accent/10 border-sp-accent/20 text-sp-accent"
                  : tier === "DECLARED_TRIAL"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-sp-surface2 border-sp-border text-sp-muted"
            }`}
          >
            {tier === "FREE"
              ? "Starter"
              : tier === "DECLARED_TRIAL"
                ? "Trial"
                : tier === "PURCHASED"
                  ? "Equipment"
                  : "Pro"}
          </span>
        </div>

        <div className="px-5 space-y-6">
          {/*  Tier-aware banners  */}
          {isActiveTrial && trialExpiresAt && (
            <TrialWarningBanner
              trialExpiresAt={trialExpiresAt}
              onUpgrade={() => router.push("/store")}
            />
          )}
          {isFreeStarter && (
            <UpgradeNudgeBanner onUpgrade={() => router.push("/store")} />
          )}

          {/*  Session detail — shown only when active program is selected  */}
          {(isViewingActiveProgram || allPrograms.length === 0) && (
            <SessionDetailPanel
              instance={instance}
              plannedSession={plannedSession}
              exercisesForView={exercisesForView}
              muscles={muscles}
              boughtFromStore={boughtFromStore}
              tier={tier}
              weights={weights}
              hasDraft={hasDraft}
              draftProgress={draftProgress}
              currentSession={currentSession}
              level={level}
              onStartNow={handleStartNow}
              onBack={() => setSelectedProgramId(null)}
              allPrograms={allPrograms}
              activeEquipmentIds={activeEquipmentIds}
            />
          )}

          {/* When a non-active program is selected, show a prompt  */}
          {selectedProgramId &&
            !isViewingActiveProgram &&
            allPrograms.length > 0 && (
              <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sp-surface2 border border-sp-border flex items-center justify-center text-2xl mx-auto">
                  {muscleGroupIcon[
                    allPrograms.find((p) => p.id === selectedProgramId)
                      ?.muscleGroup ?? "FULLBODY"
                  ] ?? "⚡"}
                </div>
                <div>
                  <p className="font-barlow font-bold text-lg tracking-tight">
                    {allPrograms.find((p) => p.id === selectedProgramId)?.name}
                  </p>
                  <p className="text-[12px] text-sp-muted2 mt-0.5">
                    You&apos;re currently running{" "}
                    <span className="text-sp-text font-medium">
                      {plan.name}
                    </span>
                    .
                  </p>
                  <p className="text-[12px] text-sp-muted mt-1">
                    Visit Programs to switch your active program.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/programs")}
                  className="bg-sp-accent text-sp-bg font-barlow font-extrabold text-[13px] tracking-widest uppercase rounded-xl px-5 py-3 hover:opacity-85 active:scale-[0.98] transition-all"
                >
                  Go to Programs →
                </button>
              </div>
            )}

          {/*  When no program selected and programs exist  */}
          {selectedProgramId === null && allPrograms.length > 0 && (
            <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center space-y-2">
              <p className="font-barlow font-bold text-lg tracking-tight">
                Select a program above
              </p>
              <p className="text-[12px] text-sp-muted2">
                Tap any accessible program to view its current session and
                exercises.
              </p>
              <button
                onClick={() => setSelectedProgramId(plan.id)}
                className="mt-2 text-[12px] font-barlow font-bold text-sp-accent uppercase tracking-wider"
              >
                Show active program →
              </button>
            </div>
          )}
        </div>
      </div>

      {/*  Weight input bottom sheet  */}
      {showWeightSheet && (
        <WeightInputSheet
          exercises={weightedExercises}
          weights={weights}
          onChange={handleWeightChange}
          onStart={handleConfirmStart}
          onClose={() => setShowWeightSheet(false)}
        />
      )}

      <Navbar />
    </>
  );
}
