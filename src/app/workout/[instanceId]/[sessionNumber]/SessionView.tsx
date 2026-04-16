"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import type { SessionDraft } from "@/app/api/session/draft/route";

// Types

type ExerciseForSession = {
  id: string;
  order: number;
  sets: number;
  reps: number;
  restSeconds: number;
  exercise: { id: string; name: string };
};

type Props = {
  instanceId: string;
  dayNumber: number;
  planName: string;
  focus: string;
  level: string;
  muscleGroup: string;
  exercises: ExerciseForSession[];
  draft?: SessionDraft | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatLevel(level: string) {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

//  Component

const muscleGroupLabel: Record<string, string> = {
  FULLBODY: "Full Body",
  UPPER: "Upper Body",
  LOWER: "Lower Body",
  CORE: "Core",
};

export default function SessionView({
  instanceId,
  dayNumber,
  planName,
  focus,
  level,
  muscleGroup,
  exercises,
  draft,
}: Props) {
  const router = useRouter();

  const titleLeft = planName.split(" ")[0];
  const titleRight = muscleGroupLabel[muscleGroup] ?? muscleGroup;

  //  Timer — rehydrate elapsed seconds from draft if resuming
  const [seconds, setSeconds] = useState(draft?.elapsedSeconds ?? 0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  const mins = pad(Math.floor(seconds / 60));
  const secs = pad(seconds % 60);

  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(seconds / 2400, 1));

  //  Exercise / set state
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(
    draft?.currentExerciseIdx ?? 0,
  );
  const [completedSets, setCompletedSets] = useState(draft?.completedSets ?? 0);

  //  Rest timer state
  const [resting, setResting] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ending state
  const [ending, setEnding] = useState(false);

  //  Exit confirmation modal
  const [showExitModal, setShowExitModal] = useState(false);

  const weightsFromStorage = useRef<Record<string, number>>(
    (() => {
      try {
        const key = `sp_weights_${instanceId}_${dayNumber}`;
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as Record<string, number>;
      } catch {
        // ignore
      }
      return {};
    })(),
  );

  const logsRef = useRef<
    {
      plannedExerciseId: string;
      actualSets: number;
      actualReps: number;
      weightKg?: number;
    }[]
  >(draft?.logs ?? []);

  const currentExercise = exercises[currentExerciseIdx] ?? null;
  const totalExercises = exercises.length;

  //  Draft persistence
  const saveDraft = useCallback(
    async (overrides?: Partial<SessionDraft>) => {
      const payload: SessionDraft = {
        sessionNumber: dayNumber,
        currentExerciseIdx,
        completedSets,
        elapsedSeconds: seconds,
        logs: logsRef.current,
        ...overrides,
      };
      try {
        await fetch("/api/session/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId, draft: payload }),
        });
      } catch {
        // non-critical — silently ignore
      }
    },
    [instanceId, dayNumber, currentExerciseIdx, completedSets, seconds],
  );

  const clearDraft = useCallback(async () => {
    try {
      await fetch("/api/session/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, draft: null }),
      });
    } catch {
      // non-critical
    }
  }, [instanceId]);

  //  startRest — declared first so handleCompleteSet can reference it
  const startRest = useCallback((duration: number) => {
    if (duration <= 0) return;
    setResting(true);
    setRestSecondsLeft(duration);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = setInterval(() => {
      setRestSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(restIntervalRef.current!);
          setResting(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const skipRest = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setResting(false);
    setRestSecondsLeft(0);
  }, []);

  //  handleEndSession — declared before handleCompleteSet
  const handleEndSession = useCallback(
    async (completed = false) => {
      if (ending) return;
      setEnding(true);

      const finalLogs = [...logsRef.current];
      // Include partial sets for the current exercise if any were done
      if (completedSets > 0 && currentExercise) {
        finalLogs.push({
          plannedExerciseId: currentExercise.id,
          actualSets: completedSets,
          actualReps: currentExercise.reps,
          weightKg: weightsFromStorage.current[currentExercise.id] || undefined,
        });
      }

      try {
        await fetch("/api/session/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceId,
            sessionNumber: dayNumber,
            durationSeconds: seconds,
            completed,
            logs: finalLogs,
          }),
        });
        // Always clear the draft on session end (completed or early exit)
        await clearDraft();
      } catch (e) {
        console.error("Failed to save session:", e);
      }

      // Clean up the pre-entered weights from localStorage now that they're saved to DB
      try {
        localStorage.removeItem(`sp_weights_${instanceId}_${dayNumber}`);
      } catch {
        // ignore
      }

      router.push("/training");
    },
    [
      ending,
      completedSets,
      currentExercise,
      instanceId,
      dayNumber,
      seconds,
      router,
      clearDraft,
    ],
  );

  //  handleCompleteSet — can now safely reference startRest & handleEndSession
  const handleCompleteSet = useCallback(() => {
    if (!currentExercise || resting || paused) return;

    const newCompletedSets = completedSets + 1;

    if (newCompletedSets >= currentExercise.sets) {
      // All sets done for this exercise — log it
      logsRef.current.push({
        plannedExerciseId: currentExercise.id,
        actualSets: currentExercise.sets,
        actualReps: currentExercise.reps,
        weightKg: weightsFromStorage.current[currentExercise.id] || undefined,
      });

      if (currentExerciseIdx + 1 < totalExercises) {
        // Move to next exercise
        const nextIdx = currentExerciseIdx + 1;
        setCurrentExerciseIdx(nextIdx);
        setCompletedSets(0);
        startRest(currentExercise.restSeconds);
        // Persist draft with updated state
        saveDraft({
          currentExerciseIdx: nextIdx,
          completedSets: 0,
          logs: logsRef.current,
          elapsedSeconds: seconds,
        });
      } else {
        // All exercises done — clear draft then end
        handleEndSession(true);
      }
    } else {
      // More sets remaining
      setCompletedSets(newCompletedSets);
      startRest(currentExercise.restSeconds);
      // Persist draft with updated set count
      saveDraft({
        completedSets: newCompletedSets,
        logs: logsRef.current,
        elapsedSeconds: seconds,
      });
    }
  }, [
    currentExercise,
    completedSets,
    currentExerciseIdx,
    totalExercises,
    resting,
    paused,
    startRest,
    handleEndSession,
    saveDraft,
    seconds,
  ]);

  //  Render

  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm flex flex-col px-5 pt-10 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-4 flex-1">
          <button
            className="w-10 h-10 rounded-full bg-sp-surface border border-sp-border flex items-center justify-center text-base shrink-0 mt-1"
            onClick={() => {
              if (!ending) {
                setPaused(true);
                setShowExitModal(true);
              }
            }}
          >
            ←
          </button>
          <div className="flex-1">
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              Day {dayNumber} · {focus}
            </p>
            <h1 className="font-barlow font-extrabold text-[30px] leading-tight tracking-tight">
              {titleLeft} <span className="text-sp-accent">·</span>{" "}
              <span className="text-sp-accent">{titleRight}</span>
            </h1>
          </div>
        </div>
        <span className="bg-sp-accent/10 border border-sp-accent/25 text-sp-accent text-[11px] font-medium rounded-lg px-2.5 py-1.5 shrink-0">
          {formatLevel(level)}
        </span>
      </div>

      {/* Timer ring */}
      <div className="flex items-center justify-center mb-8">
        <div className="relative w-56 h-56 flex items-center justify-center">
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 240 240"
          >
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="6"
            />
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke="#C8F135"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute w-44 h-44 rounded-full bg-sp-accent/5 blur-2xl" />
          <div className="relative z-10 flex flex-col items-center justify-center bg-sp-surface border border-sp-border rounded-full w-44 h-44">
            <span className="font-barlow font-extrabold text-[52px] leading-none text-sp-accent tracking-tight">
              {mins}:{secs}
            </span>
            <span className="text-[11px] text-sp-muted uppercase tracking-widest mt-1">
              {paused ? "Paused" : resting ? "Resting" : "In Progress"}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-4 flex flex-col items-center gap-1">
          <p className="font-barlow font-bold text-[26px] leading-none text-sp-text">
            {currentExercise?.sets ?? "—"}
          </p>
          <p className="text-[10px] text-sp-muted uppercase tracking-wider">
            Sets
          </p>
        </div>
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-4 flex flex-col items-center gap-1">
          <p className="font-barlow font-bold text-[14px] leading-tight text-sp-text text-center">
            {currentExercise?.exercise.name ?? "Done"}
          </p>
          <p className="text-[10px] text-sp-muted uppercase tracking-wider">
            Exercise
          </p>
        </div>
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-4 flex flex-col items-center gap-1">
          <p className="font-barlow font-bold text-[16px] leading-none text-sp-text text-center">
            {formatLevel(level)}
          </p>
          <p className="text-[10px] text-sp-muted uppercase tracking-wider">
            Level
          </p>
        </div>
      </div>

      {/* Current exercise callout OR rest timer */}
      {resting ? (
        <div className="bg-sp-surface border border-sp-accent/30 rounded-2xl px-4 py-3.5 flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] text-sp-muted uppercase tracking-widest mb-0.5">
              Rest
            </p>
            <p className="font-barlow font-bold text-xl text-sp-accent">
              {pad(Math.floor(restSecondsLeft / 60))}:
              {pad(restSecondsLeft % 60)}
            </p>
          </div>
          <button
            onClick={skipRest}
            className="text-[12px] font-barlow font-bold text-sp-accent uppercase tracking-wider border border-sp-accent/30 rounded-xl px-3 py-2"
          >
            Skip Rest
          </button>
        </div>
      ) : currentExercise ? (
        <div className="bg-sp-accent/10 border border-sp-accent/25 rounded-2xl px-4 py-3.5 flex items-center justify-between mb-6">
          <div>
            <p className="text-[11px] text-sp-muted uppercase tracking-widest mb-0.5">
              Now
            </p>
            <p className="font-barlow font-bold text-xl">
              {currentExercise.exercise.name}
            </p>
            <p className="text-[11px] text-sp-muted mt-0.5">
              {currentExercise.reps} reps per set
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-sp-muted uppercase tracking-widest mb-0.5">
              Set
            </p>
            <p className="font-barlow font-bold text-xl text-sp-accent">
              {completedSets + 1} / {currentExercise.sets}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-sp-accent/10 border border-sp-accent/25 rounded-2xl px-4 py-3.5 flex items-center justify-center mb-6">
          <p className="font-barlow font-bold text-xl text-sp-accent">
            All exercises complete!
          </p>
        </div>
      )}

      {/* Exercise progress list */}
      <div className="bg-sp-surface border border-sp-border rounded-2xl p-4 mb-6">
        <p className="text-[11px] text-sp-muted uppercase tracking-widest mb-3">
          Workout Progress · {currentExerciseIdx}/{totalExercises} done
        </p>
        <div className="space-y-2">
          {exercises.map((ex, i) => {
            const isDone = i < currentExerciseIdx;
            const isCurrent = i === currentExerciseIdx;
            return (
              <div
                key={ex.id}
                className={`flex items-center justify-between py-2 px-3 rounded-xl transition-colors ${
                  isCurrent
                    ? "bg-sp-accent/10 border border-sp-accent/25"
                    : isDone
                      ? "opacity-40"
                      : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isDone
                        ? "bg-sp-accent text-sp-bg"
                        : isCurrent
                          ? "bg-sp-accent/20 text-sp-accent"
                          : "bg-sp-surface2 text-sp-muted"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className="text-sm font-medium">
                    {ex.exercise.name}
                  </span>
                </div>
                <span className="font-barlow font-semibold text-sm text-sp-accent">
                  {isCurrent
                    ? `${completedSets}/${ex.sets}`
                    : `${ex.sets} × ${ex.reps}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 mt-auto">
        {!resting && currentExercise && (
          <button
            onClick={handleCompleteSet}
            disabled={paused}
            className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-lg tracking-widest uppercase rounded-2xl py-4 transition-opacity hover:opacity-85 active:scale-[0.98] disabled:opacity-40"
          >
            ✓ Complete Set {completedSets + 1} of {currentExercise.sets}
          </button>
        )}

        <button
          onClick={() => setPaused((p) => !p)}
          className="w-full bg-sp-surface border border-sp-border text-sp-text font-barlow font-bold text-lg tracking-widest uppercase rounded-2xl py-4 flex items-center justify-center gap-3 transition-colors hover:border-sp-muted"
        >
          {paused ? (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </>
          ) : (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </>
          )}
        </button>

        <button
          onClick={() => handleEndSession(false)}
          disabled={ending}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-barlow font-bold text-lg tracking-widest uppercase rounded-2xl py-4 flex items-center justify-center gap-3 transition-colors hover:bg-red-500/15 disabled:opacity-40"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          {ending ? "Saving..." : "End Session"}
        </button>
      </div>
      {/*  Exit confirmation modal */}
      {showExitModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm pb-8 px-5"
          onClick={() => {
            setShowExitModal(false);
            setPaused(false);
          }}
        >
          <div
            className="w-full max-w-md bg-sp-surface border border-sp-border rounded-3xl p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-sp-border rounded-full mx-auto mb-5" />

            <p className="text-[11px] tracking-widest text-sp-muted uppercase text-center mb-1">
              Session paused
            </p>
            <h2 className="font-barlow font-extrabold text-[24px] leading-tight tracking-tight text-center mb-5">
              Leave this workout?
            </h2>

            {/* Pause & save draft  */}
            <button
              onClick={async () => {
                setShowExitModal(false);
                await saveDraft();
                router.push("/training");
              }}
              className="w-full bg-sp-accent/10 border border-sp-accent/25 text-sp-accent font-barlow font-extrabold text-base tracking-widest uppercase rounded-2xl py-4 flex items-center justify-center gap-2 hover:bg-sp-accent/15 transition-colors"
            >
              ⏸ Pause &amp; Come Back Later
            </button>

            {/* End & save progress */}
            <button
              onClick={() => {
                setShowExitModal(false);
                handleEndSession(false);
              }}
              className="w-full bg-red-500/10 border border-red-500/20 text-red-400 font-barlow font-extrabold text-base tracking-widest uppercase rounded-2xl py-4 flex items-center justify-center gap-2 hover:bg-red-500/15 transition-colors"
            >
              ✕ End &amp; Save Progress
            </button>

            {/* Resume */}
            <button
              onClick={() => {
                setShowExitModal(false);
                setPaused(false);
              }}
              className="w-full text-sp-muted font-barlow font-bold text-sm tracking-widest uppercase py-3"
            >
              ← Keep Going
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
