"use client";

import Navbar from "@/components/global/Navbar";
import { useRouter } from "next/navigation";
import { useState } from "react";
import UpgradePrompt, {
  UpgradeTrigger,
} from "@/components/programs/UpgadePrompt";

// ── Types ──────────────────────────────────────────────────────────────────────

type UserPlan = "FREE" | "EQUIPMENT" | "PRO";

type HeaderStats = {
  totalWorkouts: number;
  totalHours: number;
  totalVolumeKg: number;
};

type PRHistory = {
  date: string;
  weightKg: number;
  reps: number;
};

type PR = {
  exerciseName: string;
  weightKg: number;
  reps: number;
  setAt: string;
  isNew: boolean;
  history: PRHistory[];
};

type MonthStats = {
  sessions: number;
  volumeKg: number;
  hours: number;
};

type BodySplitItem = {
  group: string;
  count: number;
  percent: number;
};

type SessionItem = {
  key: string;
  completedAt: string;
  planName: string;
  muscleGroup: string;
  focus: string;
  exerciseCount: number;
  totalVolume: number;
  sessionNumber: number;
  instanceId: string;
};

// ── Dashboard types ────────────────────────────────────────────────────────────

export type StrengthTrend = {
  exerciseName: string;
  percentChange: number;
  currentRM: number;
  priorRM: number;
  dataPoints: number;
};

export type VolumeByMuscle = {
  group: string;
  thisWeekKg: number;
  lastWeekKg: number;
  percentChange: number | null;
};

export type RecoveryStatus = "FRESH" | "MODERATE" | "HIGH_FATIGUE";

export type DashboardData = {
  consistencyScore: number;
  consistencyPlanned: number;
  consistencyCompleted: number;
  goalProgress: number;
  goalLabel: string;
  goalInsight: string;
  recoveryStatus: RecoveryStatus;
  recoveryInsight: string;
  strengthTrends: StrengthTrend[];
  volumeByMuscle: VolumeByMuscle[];
};

type Props = {
  userPlan: UserPlan;
  hasActiveTrial?: boolean;
  headerStats: HeaderStats;
  personalRecords: PR[];
  thisMonth: MonthStats;
  lastMonth: MonthStats;
  currentMonthName: string;
  prevMonthName: string;
  bodySplit: BodySplitItem[];
  sessionHistory: SessionItem[];
  dashboardData: DashboardData | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatVolume(kg: number) {
  return `${kg.toLocaleString()}kg`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

const splitColors: Record<string, string> = {
  UPPER: "#CBFF47",
  LOWER: "#4ade80",
  CORE: "#60a5fa",
  FULLBODY: "#a78bfa",
};

const splitLabels: Record<string, string> = {
  UPPER: "Upper",
  LOWER: "Lower",
  CORE: "Core",
  FULLBODY: "Full Body",
};

const muscleGroupIcon: Record<string, string> = {
  UPPER: "💪",
  LOWER: "🦵",
  CORE: "🔥",
  FULLBODY: "⚡",
};

const recoveryConfig: Record<
  RecoveryStatus,
  { emoji: string; label: string; color: string; barPct: number }
> = {
  FRESH: { emoji: "🟢", label: "Fresh", color: "#4ade80", barPct: 90 },
  MODERATE: {
    emoji: "🟡",
    label: "Moderate Fatigue",
    color: "#f59e0b",
    barPct: 55,
  },
  HIGH_FATIGUE: {
    emoji: "🔴",
    label: "High Fatigue",
    color: "#f87171",
    barPct: 20,
  },
};

// ── Locked Section Gate ────────────────────────────────────────────────────────

function LockedSection({
  label,
  sublabel,
  onUnlock,
}: {
  label: string;
  sublabel?: string;
  onUnlock: () => void;
}) {
  return (
    <div className="relative bg-sp-surface border border-sp-border rounded-2xl overflow-hidden">
      <div
        className="p-5 space-y-3 select-none pointer-events-none"
        style={{ filter: "blur(4px)" }}
        aria-hidden="true"
      >
        <div className="h-3 w-1/3 bg-sp-surface2 rounded-full" />
        <div className="h-6 bg-sp-surface2 rounded-lg" />
        <div className="h-6 w-4/5 bg-sp-surface2 rounded-lg" />
        <div className="h-6 w-3/5 bg-sp-surface2 rounded-lg" />
        <div className="h-4 w-1/2 bg-sp-surface2 rounded-full mt-1" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-sp-bg/70 backdrop-blur-[2px] px-5 gap-3">
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
        <div className="text-center">
          <p className="font-barlow font-extrabold text-[15px] tracking-tight">
            {label}
          </p>
          {sublabel && (
            <p className="text-[11px] text-sp-muted mt-1">{sublabel}</p>
          )}
        </div>
        <button
          onClick={onUnlock}
          className="bg-sp-accent text-sp-bg font-barlow font-extrabold text-[12px] tracking-widest uppercase rounded-xl px-5 py-2.5 hover:opacity-85 active:scale-[0.98] transition-all"
        >
          Unlock with Pro
        </button>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 bg-sp-surface border border-sp-border rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-[10px] tracking-widest text-sp-muted uppercase">
        {label}
      </p>
      <p className="font-barlow font-extrabold text-[28px] leading-none text-sp-text">
        {value}
      </p>
    </div>
  );
}

// ── Smart Metric Card ─────────────────────────────────────────────────────────
// Full-width horizontal card: label + icon left, big value + status right,
// progress bar + insight below.

function SmartMetricCard({
  icon,
  label,
  value,
  valueColor,
  statusLabel,
  barPct,
  insight,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor: string;
  statusLabel: string;
  barPct: number;
  insight: string;
}) {
  return (
    <div className="bg-sp-surface border border-sp-border rounded-2xl p-4">
      {/* Top row: label left, value right */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          <p className="text-[11px] tracking-widest text-sp-muted uppercase font-medium">
            {label}
          </p>
        </div>
        <div className="text-right">
          <p
            className="font-barlow font-extrabold text-[26px] leading-none"
            style={{ color: valueColor }}
          >
            {value}
          </p>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: valueColor + "bb" }}
          >
            {statusLabel}
          </p>
        </div>
      </div>
      {/* Bar */}
      <div className="h-1.5 bg-sp-surface2 rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barPct}%`, backgroundColor: valueColor }}
        />
      </div>
      {/* Insight */}
      <p className="text-[11px] text-sp-muted2 leading-snug">{insight}</p>
    </div>
  );
}

// ── Smart Metrics (3 stacked cards) ───────────────────────────────────────────

function SmartMetrics({ data }: { data: DashboardData }) {
  const cs = data.consistencyScore;
  const csColor = cs >= 75 ? "#CBFF47" : cs >= 50 ? "#f59e0b" : "#f87171";
  const csStatus =
    cs >= 80
      ? "Outstanding"
      : cs >= 65
        ? "On track"
        : cs >= 50
          ? "Could improve"
          : "Needs attention";

  const gp = data.goalProgress;
  const gpColor = gp >= 70 ? "#CBFF47" : gp >= 40 ? "#a78bfa" : "#60a5fa";

  const rc = recoveryConfig[data.recoveryStatus];
  const recoveryActionLabel =
    data.recoveryStatus === "FRESH"
      ? "Good to train"
      : data.recoveryStatus === "MODERATE"
        ? "Train smart"
        : "Consider rest";

  return (
    <div className="space-y-2.5">
      <SmartMetricCard
        icon="🔁"
        label="Consistency"
        value={`${cs}%`}
        valueColor={csColor}
        statusLabel={csStatus}
        barPct={cs}
        insight={`${data.consistencyCompleted} of ${data.consistencyPlanned} planned sessions completed`}
      />
      <SmartMetricCard
        icon="🎯"
        label={data.goalLabel}
        value={`${gp}%`}
        valueColor={gpColor}
        statusLabel="Goal Progress"
        barPct={gp}
        insight={data.goalInsight}
      />
      <SmartMetricCard
        icon={rc.emoji}
        label="Recovery"
        value={rc.label}
        valueColor={rc.color}
        statusLabel={recoveryActionLabel}
        barPct={rc.barPct}
        insight={data.recoveryInsight}
      />
    </div>
  );
}

// ── Strength Progress ─────────────────────────────────────────────────────────

function StrengthTrendsCard({ trends }: { trends: StrengthTrend[] }) {
  if (trends.length === 0) {
    return (
      <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center">
        <p className="text-sp-muted text-sm">
          Complete workouts over multiple weeks to see strength trends.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-sp-surface border border-sp-border rounded-2xl p-4 space-y-4">
      {trends.map((t) => {
        const isPos = t.percentChange >= 0;
        const color = isPos ? "#CBFF47" : "#f87171";
        const absPct = Math.abs(t.percentChange);
        const barW = Math.min(100, (absPct / 30) * 100);

        return (
          <div key={t.exerciseName}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-medium text-sp-text truncate max-w-[65%]">
                {t.exerciseName}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="font-barlow font-bold text-sm"
                  style={{ color }}
                >
                  {isPos ? "▲" : "▼"} {absPct}%
                </span>
                {t.currentRM > 0 && (
                  <span className="text-[10px] text-sp-muted">
                    {t.currentRM}kg
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-sp-surface2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${barW}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-sp-muted">
        Last 4 weeks vs prior 4 weeks · estimated 1RM
      </p>
    </div>
  );
}

// ── Weekly Volume ─────────────────────────────────────────────────────────────

function VolumeByMuscleCard({ data }: { data: VolumeByMuscle[] }) {
  const nonZero = data.filter((d) => d.thisWeekKg > 0 || d.lastWeekKg > 0);

  if (nonZero.length === 0) {
    return (
      <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center">
        <p className="text-sp-muted text-sm">
          Complete a workout this week to see volume breakdown.
        </p>
      </div>
    );
  }

  const maxKg = Math.max(
    ...nonZero.flatMap((d) => [d.thisWeekKg, d.lastWeekKg]),
    1,
  );

  return (
    <div className="bg-sp-surface border border-sp-border rounded-2xl p-4">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-sp-accent" />
          <span className="text-[10px] text-sp-muted">This week</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-white/15" />
          <span className="text-[10px] text-sp-muted">Last week</span>
        </div>
      </div>
      <div className="space-y-4">
        {nonZero.map((d) => {
          const thisW = (d.thisWeekKg / maxKg) * 100;
          const lastW = (d.lastWeekKg / maxKg) * 100;
          const pct = d.percentChange;
          const color = splitColors[d.group] ?? "#CBFF47";

          return (
            <div key={d.group}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-sp-text">
                  {splitLabels[d.group] ?? d.group}
                </span>
                {pct !== null && (
                  <span
                    className={`text-[11px] font-barlow font-bold ${pct >= 0 ? "text-sp-accent" : "text-red-400"}`}
                  >
                    {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-5 bg-sp-surface2 rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-700"
                    style={{ width: `${thisW}%`, backgroundColor: color }}
                  />
                </div>
                <span
                  className="w-16 text-[10px] font-barlow font-bold text-right shrink-0"
                  style={{ color }}
                >
                  {d.thisWeekKg > 0
                    ? `${d.thisWeekKg.toLocaleString()}kg`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-5 bg-sp-surface2 rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md bg-white/15 transition-all duration-700"
                    style={{ width: `${lastW}%` }}
                  />
                </div>
                <span className="w-16 text-[10px] font-barlow font-bold text-sp-muted2 text-right shrink-0">
                  {d.lastWeekKg > 0
                    ? `${d.lastWeekKg.toLocaleString()}kg`
                    : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PR Card ───────────────────────────────────────────────────────────────────

function PRCard({ pr }: { pr: PR }) {
  const isBodyweight = pr.weightKg === 0;
  const history = pr.history;
  const values = history.map((h) => (isBodyweight ? h.reps : h.weightKg));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  const barHeights = values.map((v) =>
    Math.max(8, ((v - minVal) / range) * 100),
  );

  return (
    <div className="snap-start shrink-0 w-52 bg-sp-surface border border-sp-border rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
      {pr.isNew && (
        <span className="absolute top-3 right-3 bg-sp-accent text-sp-bg text-[9px] font-barlow font-extrabold tracking-widest uppercase px-1.5 py-0.5 rounded-full">
          NEW PR
        </span>
      )}
      <p className="text-[11px] text-sp-muted2 leading-snug pr-10 font-medium">
        {pr.exerciseName}
      </p>
      <div className="flex items-end gap-1.5">
        {isBodyweight ? (
          <>
            <span className="font-barlow font-extrabold text-[32px] leading-none text-sp-text">
              {pr.reps}
            </span>
            <span className="text-[13px] text-sp-muted pb-1">reps</span>
          </>
        ) : (
          <>
            <span className="font-barlow font-extrabold text-[32px] leading-none text-sp-text">
              {pr.weightKg}
            </span>
            <span className="text-[13px] text-sp-muted pb-1">kg</span>
            <span className="text-[11px] text-sp-muted2 pb-1 ml-0.5">
              × {pr.reps}
            </span>
          </>
        )}
      </div>
      {history.length > 1 ? (
        <div className="mt-1">
          <div className="flex items-end gap-1 h-12">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-500"
                style={{
                  height: `${h}%`,
                  backgroundColor:
                    i === barHeights.length - 1
                      ? "#CBFF47"
                      : "rgba(203,255,71,0.25)",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-sp-muted">
              {history[0].date.slice(5)}
            </span>
            <span className="text-[9px] text-sp-accent font-medium">
              Latest
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-sp-muted mt-1">
          Do more sessions to see progression
        </p>
      )}
    </div>
  );
}

// ── Monthly Comparison Chart ───────────────────────────────────────────────────

function MonthCompareChart({
  thisMonth,
  lastMonth,
  currentMonthName,
  prevMonthName,
}: {
  thisMonth: MonthStats;
  lastMonth: MonthStats;
  currentMonthName: string;
  prevMonthName: string;
}) {
  const metrics = [
    {
      label: "Sessions",
      current: thisMonth.sessions,
      previous: lastMonth.sessions,
      format: (n: number) => `${n}`,
    },
    {
      label: "Volume",
      current: thisMonth.volumeKg,
      previous: lastMonth.volumeKg,
      format: formatVolume,
    },
    {
      label: "Hours",
      current: thisMonth.hours,
      previous: lastMonth.hours,
      format: (n: number) => `${n}h`,
    },
  ];

  return (
    <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-sp-accent" />
          <span className="text-[11px] text-sp-muted">{currentMonthName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-white/15" />
          <span className="text-[11px] text-sp-muted">{prevMonthName}</span>
        </div>
      </div>
      {metrics.map(({ label, current, previous, format }) => {
        const maxVal = Math.max(current, previous, 1);
        const currentPct = (current / maxVal) * 100;
        const previousPct = (previous / maxVal) * 100;
        const diff = current - previous;
        const diffPct =
          previous > 0 ? Math.round(Math.abs((diff / previous) * 100)) : null;

        return (
          <div key={label} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-sp-muted uppercase tracking-wider">
                {label}
              </span>
              {diffPct !== null && (
                <span
                  className={`text-[11px] font-barlow font-bold ${diff >= 0 ? "text-sp-accent" : "text-red-400"}`}
                >
                  {diff >= 0 ? "▲" : "▼"} {Math.abs(diffPct)}%
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-10 text-[10px] text-sp-muted text-right shrink-0">
                  {currentMonthName}
                </div>
                <div className="flex-1 h-6 bg-sp-surface2 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-sp-accent transition-all duration-700"
                    style={{ width: `${currentPct}%` }}
                  />
                </div>
                <div className="w-16 text-[11px] font-barlow font-bold text-sp-accent text-right shrink-0">
                  {format(current)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 text-[10px] text-sp-muted text-right shrink-0">
                  {prevMonthName}
                </div>
                <div className="flex-1 h-6 bg-sp-surface2 rounded-lg overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-white/15 transition-all duration-700"
                    style={{ width: `${previousPct}%` }}
                  />
                </div>
                <div className="w-16 text-[11px] font-barlow font-bold text-sp-muted2 text-right shrink-0">
                  {format(previous)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Plan badge ─────────────────────────────────────────────────────────────────

const planBadge: Record<UserPlan, { label: string; classes: string }> = {
  FREE: {
    label: "Starter",
    classes: "bg-sp-surface2 border-sp-border text-sp-muted",
  },
  EQUIPMENT: {
    label: "Equipment",
    classes: "bg-sp-accent/10 border-sp-accent/20 text-sp-accent",
  },
  PRO: {
    label: "Pro",
    classes: "bg-sp-accent/10 border-sp-accent/20 text-sp-accent",
  },
};

// ── Floating Upgrade Banner ────────────────────────────────────────────────────

function FloatingUpgradeBanner({ onUpgrade }: { onUpgrade: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-5 pointer-events-none">
      <div className="w-full max-w-md bg-sp-surface border border-sp-accent/30 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-lg shadow-black/30 pointer-events-auto">
        <div className="w-9 h-9 rounded-xl bg-sp-accent/10 border border-sp-accent/20 flex items-center justify-center shrink-0 text-base">
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sp-text">
            Unlock full analytics
          </p>
          <p className="text-[11px] text-sp-muted2 mt-0.5">
            Monthly trends, body split &amp; full history
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="shrink-0 bg-sp-accent text-sp-bg font-barlow font-extrabold text-[11px] tracking-widest uppercase rounded-xl px-3 py-2 hover:opacity-85 active:scale-[0.98] transition-all"
        >
          Go Pro
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-sp-muted hover:text-sp-text transition-colors ml-1"
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
    </div>
  );
}

// ── Section header helper ──────────────────────────────────────────────────────

function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-barlow font-bold text-xl tracking-wide">{title}</h2>
      {right}
    </div>
  );
}

function ProBadge() {
  return (
    <span className="text-[10px] font-barlow font-bold text-sp-accent uppercase tracking-wider border border-sp-accent/30 rounded-md px-1.5 py-0.5">
      Pro
    </span>
  );
}

// ── Main View ──────────────────────────────────────────────────────────────────

export default function ProgressView({
  userPlan,
  hasActiveTrial = false,
  headerStats,
  personalRecords,
  thisMonth,
  lastMonth,
  currentMonthName,
  prevMonthName,
  bodySplit,
  sessionHistory,
  dashboardData,
}: Props) {
  const router = useRouter();
  const [historyLimit, setHistoryLimit] = useState(6);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] =
    useState<UpgradeTrigger>("analytics");

  function openUpgrade(trigger: UpgradeTrigger) {
    setUpgradeTrigger(trigger);
    setUpgradeOpen(true);
  }

  const isPro = userPlan === "PRO";
  const isLimitedView = !isPro;
  const hasFullHistory = isPro;
  const visibleHistory = hasFullHistory
    ? sessionHistory.slice(0, historyLimit)
    : sessionHistory.slice(0, 3);

  const badge = planBadge[userPlan];

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm pb-28 px-5 pt-6 space-y-6 max-w-md mx-auto">
        {/* ── 1. Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-widest text-sp-muted uppercase mb-1">
              Your Journey
            </p>
            <h1 className="font-barlow font-extrabold text-[32px] leading-tight tracking-tight">
              Progress
            </h1>
          </div>
          <span
            className={`mt-1.5 text-[10px] font-barlow font-bold tracking-widest uppercase border rounded-lg px-2.5 py-1 ${badge.classes}`}
          >
            {badge.label}
          </span>
        </div>

        {/* ── Plan notices ── */}
        {hasActiveTrial && userPlan !== "PRO" && (
          <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-amber-400 text-base">⏳</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sp-text">Trial active</p>
              <p className="text-[11px] text-sp-muted2 leading-snug">
                Advanced analytics unlock when you upgrade to Pro
              </p>
            </div>
          </div>
        )}
        {userPlan === "EQUIPMENT" && !hasActiveTrial && (
          <div className="bg-sp-surface border border-sp-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-base">📊</span>
              <div>
                <p className="text-sm font-medium text-sp-text">
                  Unlock full analytics
                </p>
                <p className="text-[11px] text-sp-muted2 leading-snug">
                  Upgrade to Pro for monthly trends &amp; body split
                </p>
              </div>
            </div>
            <button
              onClick={() => openUpgrade("analytics")}
              className="shrink-0 bg-sp-accent text-sp-bg font-barlow font-extrabold text-[11px] tracking-widest uppercase rounded-xl px-3 py-2 hover:opacity-85 transition-opacity"
            >
              Go Pro
            </button>
          </div>
        )}

        {/* ── 2. All-time stats — always visible, always first ── */}
        <section>
          <p className="text-[10px] tracking-widest text-sp-muted uppercase mb-2.5">
            All Time
          </p>
          <div className="flex gap-2.5">
            <StatCard
              label="Workouts"
              value={headerStats.totalWorkouts.toString()}
            />
            <StatCard label="Hours" value={`${headerStats.totalHours}h`} />
            <StatCard
              label="Volume"
              value={formatVolume(headerStats.totalVolumeKg)}
            />
          </div>
        </section>

        {/* ── 3. Smart Metrics (Consistency / Goal / Recovery) — PRO ── */}
        <section>
          <SectionHeader
            title="Smart Metrics"
            right={!isPro ? <ProBadge /> : undefined}
          />
          {isPro ? (
            dashboardData ? (
              <SmartMetrics data={dashboardData} />
            ) : (
              <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center">
                <p className="text-sp-muted text-sm">
                  Complete a session to unlock smart metrics.
                </p>
              </div>
            )
          ) : (
            <LockedSection
              label="Smart Metrics"
              sublabel="Consistency score, goal progress & recovery status"
              onUnlock={() => openUpgrade("analytics")}
            />
          )}
        </section>

        {/* ── 4. Strength Progress — PRO ── */}
        <section>
          <SectionHeader
            title="Strength Progress"
            right={!isPro ? <ProBadge /> : undefined}
          />
          {isPro ? (
            <StrengthTrendsCard trends={dashboardData?.strengthTrends ?? []} />
          ) : (
            <LockedSection
              label="Strength Progress"
              sublabel="Track your strength gains per exercise over time"
              onUnlock={() => openUpgrade("analytics")}
            />
          )}
        </section>

        {/* ── 5. Weekly Training Volume — PRO ── */}
        <section>
          <SectionHeader
            title="Weekly Volume"
            right={!isPro ? <ProBadge /> : undefined}
          />
          {isPro ? (
            <VolumeByMuscleCard data={dashboardData?.volumeByMuscle ?? []} />
          ) : (
            <LockedSection
              label="Weekly Training Volume"
              sublabel="See volume changes per muscle group week over week"
              onUnlock={() => openUpgrade("analytics")}
            />
          )}
        </section>

        {/* ── 6. Personal Records — always visible ── */}
        <section>
          <SectionHeader
            title="Personal Records"
            right={
              <span className="text-[11px] text-sp-muted2">
                {personalRecords.length} exercise
                {personalRecords.length !== 1 ? "s" : ""}
              </span>
            }
          />
          {personalRecords.length === 0 ? (
            <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center">
              <p className="text-sp-muted text-sm">
                No records yet — complete a workout to start tracking PRs.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
              {personalRecords.map((pr) => (
                <PRCard key={pr.exerciseName} pr={pr} />
              ))}
            </div>
          )}
        </section>

        {/* ── 7. This Month vs Last — PRO ── */}
        <section>
          <SectionHeader
            title="This Month vs Last"
            right={!isPro ? <ProBadge /> : undefined}
          />
          {isPro ? (
            <MonthCompareChart
              thisMonth={thisMonth}
              lastMonth={lastMonth}
              currentMonthName={currentMonthName}
              prevMonthName={prevMonthName}
            />
          ) : (
            <LockedSection
              label="Monthly Comparison"
              sublabel="Upgrade to Pro to track your month-on-month progress"
              onUnlock={() => openUpgrade("analytics")}
            />
          )}
        </section>

        {/* ── 8. Body Split — PRO ── */}
        <section>
          <SectionHeader
            title="Body Split"
            right={
              isPro ? (
                <span className="text-[11px] text-sp-muted2 capitalize">
                  {new Date().toLocaleString("default", { month: "long" })}
                </span>
              ) : (
                <ProBadge />
              )
            }
          />
          {isPro ? (
            <div className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-4">
              {bodySplit.map(({ group, percent }) => (
                <div key={group} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-sp-text">
                      {splitLabels[group] ?? group}
                    </span>
                    <span className="font-barlow font-bold text-sm text-sp-muted2">
                      {percent}%
                    </span>
                  </div>
                  <div className="h-2 bg-sp-surface2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: splitColors[group] ?? "#CBFF47",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <LockedSection
              label="Body Split Breakdown"
              sublabel="See how you distribute training across muscle groups"
              onUnlock={() => openUpgrade("analytics")}
            />
          )}
        </section>

        {/* ── 9. Session History ── */}
        <section>
          <SectionHeader
            title="Session History"
            right={
              isLimitedView && sessionHistory.length > 3 ? (
                <button
                  onClick={() => openUpgrade("volume_history")}
                  className="text-[11px] font-barlow font-bold text-sp-accent uppercase tracking-wider"
                >
                  See all →
                </button>
              ) : undefined
            }
          />
          <div className="space-y-2.5">
            {sessionHistory.length === 0 ? (
              <div className="bg-sp-surface border border-sp-border rounded-2xl px-5 py-6 text-center">
                <p className="text-sp-muted text-sm">
                  No sessions yet. Start your first workout!
                </p>
              </div>
            ) : (
              <>
                {visibleHistory.map((s) => (
                  <button
                    key={s.key}
                    onClick={() =>
                      router.push(
                        `/progress/session/${s.instanceId}/${s.sessionNumber}`,
                      )
                    }
                    className="w-full text-left bg-sp-surface border border-sp-border rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:border-sp-accent/40 transition-colors active:scale-[0.99]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-sp-surface2 border border-sp-border flex items-center justify-center text-lg shrink-0">
                      {muscleGroupIcon[s.muscleGroup] ?? "🏋️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sp-text truncate">
                        {s.focus}
                      </p>
                      <p className="text-[11px] text-sp-muted2 truncate">
                        {s.planName} · {s.exerciseCount} exercises
                      </p>
                      <p className="text-[10px] text-sp-muted mt-0.5">
                        {relativeDate(s.completedAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-barlow font-bold text-sm text-sp-accent">
                        {formatVolume(s.totalVolume)}
                      </p>
                      <p className="text-[10px] text-sp-muted2">volume</p>
                    </div>
                  </button>
                ))}

                {isLimitedView && sessionHistory.length > 3 && (
                  <button
                    onClick={() => openUpgrade("volume_history")}
                    className="relative w-full bg-sp-surface border border-sp-border rounded-2xl px-4 py-3.5 flex items-center gap-3 overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-3 w-full select-none pointer-events-none"
                      style={{ filter: "blur(3px)" }}
                      aria-hidden="true"
                    >
                      <div className="w-9 h-9 rounded-xl bg-sp-surface2 border border-sp-border shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-2/3 bg-sp-surface2 rounded-full" />
                        <div className="h-2.5 w-1/2 bg-sp-surface2 rounded-full" />
                      </div>
                      <div className="h-4 w-12 bg-sp-surface2 rounded-full shrink-0" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-sp-bg/60 backdrop-blur-[1px]">
                      <span className="font-barlow font-extrabold text-[12px] tracking-widest uppercase text-sp-accent">
                        🔒 Upgrade to see {sessionHistory.length - 3} more
                      </span>
                    </div>
                  </button>
                )}

                {hasFullHistory && sessionHistory.length > historyLimit && (
                  <button
                    onClick={() => setHistoryLimit((l: number) => l + 10)}
                    className="w-full text-center text-[12px] font-barlow font-bold text-sp-accent uppercase tracking-wider py-3"
                  >
                    Load More ↓
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {isLimitedView && (
        <FloatingUpgradeBanner onUpgrade={() => openUpgrade("analytics")} />
      )}

      <Navbar />

      <UpgradePrompt
        trigger={upgradeTrigger}
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
