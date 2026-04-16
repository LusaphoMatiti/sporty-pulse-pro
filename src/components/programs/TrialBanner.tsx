"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  trialExpiresAt: string;
  equipmentName: string;
  onUpgrade?: () => void;
};

function getTimeLeft(expiresAt: string): {
  days: number;
  hours: number;
  expired: boolean;
} {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, expired: true };
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours, expired: false };
}

function urgencyLevel(days: number): "low" | "medium" | "high" {
  if (days >= 7) return "low";
  if (days >= 3) return "medium";
  return "high";
}

export default function TrialBanner({
  trialExpiresAt,
  equipmentName,
  onUpgrade,
}: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(trialExpiresAt));

  // Tick every minute — precise enough for a day-level countdown
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(getTimeLeft(trialExpiresAt));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [trialExpiresAt]);

  if (dismissed || timeLeft.expired) return null;

  const urgency = urgencyLevel(timeLeft.days);

  const colors: Record<
    typeof urgency,
    { bg: string; border: string; pill: string; pillText: string; bar: string }
  > = {
    low: {
      bg: "bg-sp-accent/8",
      border: "border-sp-accent/20",
      pill: "bg-sp-accent/15 border-sp-accent/30",
      pillText: "text-sp-accent",
      bar: "bg-sp-accent",
    },
    medium: {
      bg: "bg-amber-500/8",
      border: "border-amber-500/25",
      pill: "bg-amber-500/15 border-amber-500/30",
      pillText: "text-amber-400",
      bar: "bg-amber-400",
    },
    high: {
      bg: "bg-red-500/8",
      border: "border-red-500/20",
      pill: "bg-red-500/10 border-red-500/20",
      pillText: "text-red-400",
      bar: "bg-red-400",
    },
  };

  const c = colors[urgency];

  const TRIAL_DAYS = 14;
  const elapsed = TRIAL_DAYS - timeLeft.days;
  const progressPct = Math.min(100, Math.round((elapsed / TRIAL_DAYS) * 100));

  const countdownLabel =
    timeLeft.days === 0
      ? `${timeLeft.hours}h left`
      : timeLeft.days === 1
        ? `1 day left`
        : `${timeLeft.days} days left`;

  const handleCta = () => {
    onUpgrade?.() ?? router.push("/store");
  };

  return (
    <div
      className={`relative rounded-2xl border px-4 py-3.5 ${c.bg} ${c.border}`}
      role="status"
      aria-label={`${equipmentName} trial: ${countdownLabel}`}
    >
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-sp-muted hover:text-sp-text transition-colors"
        aria-label="Dismiss trial banner"
      >
        <svg
          width="14"
          height="14"
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

      {/* Top row */}
      <div className="flex items-center gap-2.5 mb-2.5 pr-6">
        {/* Hourglass icon */}
        <div
          className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${c.pill}`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={c.pillText}
          >
            <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sp-text leading-tight">
            {equipmentName} trial
          </p>
          <p className="text-[11px] text-sp-muted2 leading-tight">
            Go Pro before it expires to keep access
          </p>
        </div>

        {/* Countdown pill */}
        <span
          className={`text-[11px] font-barlow font-bold uppercase tracking-wide rounded-lg px-2.5 py-1 border shrink-0 ${c.pill} ${c.pillText}`}
        >
          {countdownLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-sp-surface2 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${c.bar}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* CTA row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-sp-muted">
          {TRIAL_DAYS - elapsed} of {TRIAL_DAYS} trial days remaining
        </p>
        <button
          onClick={handleCta}
          className={`text-[11px] font-barlow font-bold uppercase tracking-wider ${c.pillText} hover:opacity-75 transition-opacity`}
        >
          Go Pro to keep access →
        </button>
      </div>
    </div>
  );
}
