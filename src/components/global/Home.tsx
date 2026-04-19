"use client";

// src/app/(app)/home/Home.tsx  (or wherever your Home.tsx lives)
// Replaces / extends your existing Home component.
// NEW: when totalWorkouts === 0, renders the Day 1 locked state
// instead of the normal dashboard.

import Navbar from "@/components/global/Navbar";
import Image from "next/image";
import { Session } from "next-auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ProfileSheet from "@/components/global/ProfileSheet";

// ── Types ─────────────────────────────────────────────────────────

type WeekDay = {
  day: string;
  worked: boolean;
  isFuture: boolean;
};

type HomeData = {
  totalWorkouts: number;
  trainedHours: string;
  totalSets: number;
  currentStreak: number;
  bestStreak: number;
  weekDays: WeekDay[];
  planWeek: number | null;
  sessionsLeft: number | null;
  planName: string | null;
  weekCompletedCount: number;
  weekTotalCount: number;
  weekWorkouts: { name: string; progress: number }[];
  nextSessionUrl: string | null;
};

type HomeProps = {
  session: Session;
  homeData: HomeData;
};

// ── Greeting helper ───────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

// ── Day 1 Locked State ────────────────────────────────────────────
// Shown when the user has never completed a workout yet.

function Day1Home({
  session,
  sheetOpen,
  setSheetOpen,
}: {
  session: Session;
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;
}) {
  const router = useRouter();
  const greeting = getGreeting();

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text pb-28 px-5 pt-6 space-y-8">
        {/* Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              {greeting}, {session.user?.name}
            </p>
            <h1 className="font-barlow font-extrabold text-[42px] leading-none tracking-tight">
              Welcome to <span className="text-sp-accent">your</span>
              <br />
              journey.
            </h1>
            <p className="text-sp-muted2 text-sm mt-2 font-light">
              Day 1 starts when you pick a plan.
            </p>
          </div>

          <button onClick={() => setSheetOpen(true)}>
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="profile"
                width={44}
                height={44}
                className="rounded-full border border-sp-border shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-sp-surface border border-sp-border flex items-center justify-center font-barlow font-bold text-lg text-sp-accent shrink-0">
                {session.user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}
          </button>

          <ProfileSheet
            session={session}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
          />
        </div>

        {/* Recovery / readiness card — placeholder until they have data */}
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-sp-accent opacity-5 blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] tracking-widest text-sp-muted uppercase">
              Recovery Status
            </span>
            <span className="flex items-center gap-1.5 bg-white/5 border border-sp-border rounded-full px-3 py-1 text-[12px] text-sp-muted">
              🔒 Unlocks after first session
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-sp-surface2 border-2 border-dashed border-sp-border flex items-center justify-center">
              <span className="text-2xl">😴</span>
            </div>
            <div>
              <p className="font-barlow font-extrabold text-[28px] leading-none text-sp-muted">
                — %
              </p>
              <p className="text-sm text-sp-muted2 mt-0.5">
                No recovery data yet
              </p>
              <p className="text-[11px] text-sp-muted mt-0.5">
                Complete your first workout to start tracking
              </p>
            </div>
          </div>
        </div>

        {/* Locked metrics */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Workouts", icon: "/equipment.png", highlight: true },
            { label: "Trained", icon: "/gym.png" },
            { label: "Sets", icon: "/bar.png" },
          ].map(({ label, icon, highlight }) => (
            <div
              key={label}
              className={`rounded-2xl p-3.5 border relative overflow-hidden ${
                highlight
                  ? "bg-sp-accent/5 border-sp-accent/15"
                  : "bg-sp-surface border-sp-border"
              }`}
            >
              {/* Lock overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-sp-bg/60 backdrop-blur-[2px] rounded-2xl z-10">
                <span className="text-lg">🔒</span>
              </div>
              <Image
                className="bg-white mb-4 p-1 rounded-full opacity-30"
                src={icon}
                alt="icon"
                width={30}
                height={30}
              />
              <p className="font-barlow font-bold text-[28px] leading-none text-sp-muted opacity-30">
                0
              </p>
              <p className="text-[10px] text-sp-muted uppercase tracking-wider mt-1 opacity-30">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* This week — empty locked state */}
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-barlow font-bold text-xl tracking-wide">
              This Week
            </h2>
            <span className="text-[11px] text-sp-muted">No plan yet</span>
          </div>
          <div className="space-y-3">
            {/* Placeholder skeleton rows */}
            {[0.7, 0.5, 0.85].map((opacity, i) => (
              <div key={i} className="opacity-20" style={{ opacity }}>
                <div className="flex justify-between mb-1.5">
                  <div className="h-3 w-24 bg-sp-muted rounded-full" />
                  <div className="h-3 w-8 bg-sp-muted rounded-full" />
                </div>
                <div className="w-full h-0.75 bg-white/5 rounded-full" />
              </div>
            ))}
          </div>
          <p className="text-sm text-sp-muted mt-4 text-center">
            Pick a plan to see your sessions here
          </p>
        </div>

        {/* Big CTA */}
        <button
          onClick={() => router.push("/programs")}
          className="w-full bg-sp-accent text-sp-bg font-barlaw font-extrabold text-lg tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98]"
        >
          ▶ Pick Your First Plan
        </button>
      </div>
      <Navbar />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function Home({ session, homeData }: HomeProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();

  const {
    totalWorkouts,
    trainedHours,
    totalSets,
    currentStreak,
    bestStreak,
    weekDays,
    planWeek,
    sessionsLeft,
    planName,
    weekCompletedCount,
    weekTotalCount,
    weekWorkouts,
    nextSessionUrl,
  } = homeData;

  // ── Day 1 branch ───────────────────────────────────────────────
  if (totalWorkouts === 0) {
    return (
      <Day1Home
        session={session}
        sheetOpen={sheetOpen}
        setSheetOpen={setSheetOpen}
      />
    );
  }

  // ── Normal dashboard (unchanged from original) ─────────────────

  const metrics = [
    {
      label: "Workouts",
      value: totalWorkouts.toString(),
      icon: "/equipment.png",
      highlight: true,
    },
    { label: "Trained", value: trainedHours, icon: "/gym.png" },
    { label: "Sets", value: totalSets.toString(), icon: "/bar.png" },
  ];

  const isOnFire = currentStreak >= 3;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text pb-28 px-5 pt-6 space-y-8">
        {/* Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              {greeting} {session.user?.name}
            </p>
            <h1 className="font-barlow font-extrabold text-[42px] leading-none tracking-tight">
              Let&apos;s <span className="text-sp-accent">crush</span>
              <br />
              it today.
            </h1>
            <p className="text-sp-muted2 text-sm mt-2 font-light">
              {planName && planWeek !== null && sessionsLeft !== null ? (
                <>
                  Week {planWeek} of {planName} · {sessionsLeft} session
                  {sessionsLeft !== 1 ? "s" : ""} left
                </>
              ) : (
                "No active plan — start one to begin tracking"
              )}
            </p>
          </div>

          <button onClick={() => setSheetOpen(true)}>
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="profile"
                width={44}
                height={44}
                className="rounded-full border border-sp-border shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-sp-surface border border-sp-border flex items-center justify-center font-barlow font-bold text-lg text-sp-accent shrink-0">
                {session.user.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}
          </button>

          <ProfileSheet
            session={session}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
          />
        </div>

        {/* Streak card */}
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-sp-accent opacity-5 blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] tracking-widest text-sp-muted uppercase">
              Current Streak
            </span>
            {isOnFire ? (
              <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 text-[12px] text-red-400">
                🔥 On fire
              </span>
            ) : currentStreak > 0 ? (
              <span className="flex items-center gap-1.5 bg-sp-accent/10 border border-sp-accent/20 rounded-full px-3 py-1 text-[12px] text-sp-accent">
                💪 Keep going
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-white/5 border border-sp-border rounded-full px-3 py-1 text-[12px] text-sp-muted">
                Start today
              </span>
            )}
          </div>

          <div className="flex items-end gap-3 mb-5">
            <span className="font-barlow font-extrabold text-[72px] leading-none text-sp-accent">
              {currentStreak}
            </span>
            <div className="pb-2">
              <p className="text-sm text-sp-muted2">days in a row</p>
              <p className="text-[11px] text-sp-muted mt-0.5">
                Best: {bestStreak} day{bestStreak !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {weekDays.map(({ day, worked, isFuture }, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                <div className="w-1.5 h-14 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`w-full rounded-full transition-all ${
                      isFuture
                        ? "bg-transparent"
                        : worked
                          ? "bg-sp-accent"
                          : "bg-sp-accent/20"
                    }`}
                    style={{
                      height: worked ? "100%" : isFuture ? "0%" : "20%",
                    }}
                  />
                </div>
                <span className="text-[10px] text-sp-muted">{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2">
          {metrics.map(({ label, value, icon, highlight }) => (
            <div
              key={label}
              className={`rounded-2xl p-3.5 border ${
                highlight
                  ? "bg-sp-accent/10 border-sp-accent/25"
                  : "bg-sp-surface border-sp-border"
              }`}
            >
              <Image
                className="bg-white mb-4 p-1 rounded-full"
                src={icon}
                alt="icon"
                width={30}
                height={30}
              />
              <p
                className={`font-barlow font-bold text-[28px] leading-none ${highlight ? "text-sp-accent" : "text-sp-text"}`}
              >
                {value}
              </p>
              <p className="text-[10px] text-sp-muted uppercase tracking-wider mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* This week */}
        <div className="bg-sp-surface border border-sp-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-barlow font-bold text-xl tracking-wide">
              This Week
            </h2>
            {weekTotalCount > 0 && (
              <span className="bg-sp-accent/10 border border-sp-accent/25 text-sp-accent text-[11px] font-medium rounded-full px-3 py-1">
                {weekCompletedCount} / {weekTotalCount} done
              </span>
            )}
          </div>

          {weekWorkouts.length === 0 ? (
            <p className="text-sm text-sp-muted">
              No active plan — sessions will appear here once you start one.
            </p>
          ) : (
            <div className="space-y-3.5">
              {weekWorkouts.map(({ name, progress }) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{name}</span>
                    <span className="text-sp-muted">{progress}%</span>
                  </div>
                  <div className="w-full h-0.75 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        progress === 100 ? "bg-sp-accent" : "bg-sp-muted2"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => nextSessionUrl && router.push(nextSessionUrl)}
          disabled={!nextSessionUrl}
          className="w-full bg-sp-accent text-sp-bg font-barlaw font-extrabold text-lg tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {nextSessionUrl ? "▶ Start Today's Session" : "✓ Plan Complete"}
        </button>
      </div>
      <Navbar />
    </>
  );
}
