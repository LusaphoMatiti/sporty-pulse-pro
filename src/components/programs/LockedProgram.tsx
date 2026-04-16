"use client";
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

type LockReason =
  | "trial_expired"
  | "cap_reached"
  | "equipment_required"
  | "upgrade_required";

type Props = {
  plan: PlanStub;
  reason: LockReason;
  onUpgrade?: () => void;
};

const muscleGroupLabel: Record<string, string> = {
  FULLBODY: "Full Body",
  UPPER: "Upper Body",
  LOWER: "Lower Body",
  CORE: "Core",
};

const reasonMeta: Record<
  LockReason,
  {
    label: string;
    cta: string;
  }
> = {
  trial_expired: {
    label: "Trial ended",
    cta: "Purchase to unlock",
  },
  cap_reached: {
    label: "Program limit reached",
    cta: "Go Pro",
  },
  equipment_required: {
    label: "Equipment required",
    cta: "Get access",
  },
  upgrade_required: {
    label: "Pro required",
    cta: "Go Pro",
  },
};

export default function LockedProgramCard({ plan, reason, onUpgrade }: Props) {
  const router = useRouter();
  const { label, cta } = reasonMeta[reason];

  const handleCta = () => {
    if (reason === "cap_reached" || reason === "upgrade_required") {
      onUpgrade?.();
    } else {
      router.push("/store");
    }
  };

  return (
    <div className="relative bg-sp-surface border border-sp-border rounded-2xl overflow-hidden opacity-90">
      {/* Blurred content layer */}
      <div
        className="px-4 pt-4 pb-3 select-none pointer-events-none"
        aria-hidden="true"
        style={{ filter: "blur(3px)" }}
      >
        {/* Tier badge + muscle group */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] tracking-widest text-sp-muted uppercase">
            {muscleGroupLabel[plan.muscleGroup] ?? plan.muscleGroup}
          </span>
          <span className="bg-sp-accent/10 border border-sp-accent/20 text-sp-accent text-[10px] font-medium rounded-lg px-2 py-1">
            {plan.tier.charAt(0) + plan.tier.slice(1).toLowerCase()} Tier
          </span>
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
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-sp-bg/70 backdrop-blur-[2px] px-5">
        {/* Lock icon */}
        <div className="w-10 h-10 rounded-2xl bg-sp-surface border border-sp-border flex items-center justify-center mb-3">
          <svg
            width="18"
            height="18"
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

        {/* Reason pill */}
        <span className="text-[10px] tracking-widest text-sp-muted uppercase border border-sp-border rounded-full px-3 py-1 mb-3">
          {label}
        </span>

        {/* Plan name  */}
        <p className="font-barlow font-extrabold text-[17px] tracking-tight text-center mb-4 px-2">
          {plan.name}
        </p>

        {/* CTA */}
        <button
          onClick={handleCta}
          className="w-full max-w-55 bg-sp-accent text-sp-bg font-barlow font-extrabold text-[13px] tracking-widest uppercase rounded-xl py-3 hover:opacity-85 active:scale-[0.98] transition-all"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}
