import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type UpgradeTrigger =
  | "cap_reached"
  | "equipment_required"
  | "upgrade_required"
  | "trial_expired"
  | "ai_coach"
  | "analytics"
  | "personalized"
  | "not_purchased"
  | "volume_history";

type Props = {
  trigger: UpgradeTrigger;
  open: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
};

type TriggerMeta = {
  eyebrow: string;
  heading: string;
  body: string;
  cta: string;
  features: string[];
};

const triggerMeta: Record<UpgradeTrigger, TriggerMeta> = {
  cap_reached: {
    eyebrow: "Program limit reached",
    heading: "Go Pro for\nunlimited programs",
    body: "You're on the free plan, which supports 2 active programs. Upgrade to Pro to run as many as you want — simultaneously.",
    cta: "Upgrade to Pro",
    features: [
      "Unlimited active programs",
      "AI Coach — personalised advice",
      "Advanced analytics & volume history",
      "Personalised program generation",
    ],
  },
  ai_coach: {
    eyebrow: "Pro feature",
    heading: "Meet your\nAI Coach",
    body: "Get real-time, personalised coaching based on your training history, recovery, and goals — available 24/7.",
    cta: "Unlock AI Coach",
    features: [
      "Personalised session feedback",
      "Recovery & readiness scoring",
      "Adaptive program adjustments",
      "Chat with your coach anytime",
    ],
  },
  equipment_required: {
    eyebrow: "Equipment required",
    heading: "Unlock equipment\nbased programs",
    body: "This program requires equipment you don’t have access to. Upgrade to Pro to unlock all equipment programs.",
    cta: "Unlock programs",
    features: [
      "Access all equipment programs",
      "Train with dumbbells, barbells & more",
      "No restrictions on program types",
      "Full training library unlocked",
    ],
  },

  upgrade_required: {
    eyebrow: "Free plan limit",
    heading: "Unlock more\nprograms",
    body: "You’re currently on the free plan. Upgrade to Pro to access more than 2 programs and unlock the full library.",
    cta: "Upgrade to Pro",
    features: [
      "Unlimited program access",
      "All bodyweight & equipment programs",
      "No restrictions",
      "Full training library",
    ],
  },

  trial_expired: {
    eyebrow: "Trial ended",
    heading: "Your trial\nhas expired",
    body: "Your equipment trial has ended. Upgrade to continue using equipment-based programs.",
    cta: "Continue with Pro",
    features: [
      "Restore equipment access",
      "Continue your current programs",
      "Unlimited training options",
      "Full feature access",
    ],
  },
  analytics: {
    eyebrow: "Pro feature",
    heading: "Advanced\nanalytics",
    body: "Visualise your strength curves, volume trends, and muscle balance. Know exactly where you're improving — and where you're not.",
    cta: "Unlock Analytics",
    features: [
      "Strength curve per exercise",
      "Weekly & monthly volume charts",
      "Muscle group balance heatmap",
      "Personal record progression",
    ],
  },
  personalized: {
    eyebrow: "Pro feature",
    heading: "Programs built\nfor you",
    body: "Stop following generic plans. Pro generates a program tailored to your equipment, goals, level, and schedule.",
    cta: "Unlock Personalised Plans",
    features: [
      "AI-generated 4–12 week programs",
      "Adapts to your equipment",
      "Goal-specific periodisation",
      "Adjusts weekly based on progress",
    ],
  },
  volume_history: {
    eyebrow: "Pro feature",
    heading: "Full volume\nhistory",
    body: "See your total volume lifted over any time range — weekly, monthly, all-time — broken down by muscle group.",
    cta: "Unlock Volume History",
    features: [
      "All-time volume tracking",
      "Breakdown by muscle group",
      "Week-on-week comparisons",
      "Export your data",
    ],
  },
  not_purchased: {
    //
    eyebrow: "Equipment required",
    heading: "Get access\nto this program",
    body: "This program requires equipment you haven't purchased. Unlock it to start training.",
    cta: "Get Access",
    features: [
      "Unlock this equipment",
      "Start the program today",
      "Track progress & reps",
      "Full video guidance",
    ],
  },
};

export default function UpgradePrompt({
  trigger,
  open,
  onClose,
  onUpgrade,
}: Props) {
  const router = useRouter();
  const sheetRef = useRef<HTMLDivElement>(null);
  const meta = triggerMeta[trigger];

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const handleCta = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      router.push("/upgrade");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm pb-0 px-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md bg-sp-surface border border-sp-border rounded-t-3xl px-5 pt-5 pb-10 animate-slide-up"
        style={{ maxHeight: "90dvh", overflowY: "auto" }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-sp-border mx-auto mb-5" />

        {/* Eyebrow */}
        <p className="text-[10px] tracking-widest text-sp-muted uppercase text-center mb-2">
          {meta.eyebrow}
        </p>

        {/* Heading — Barlow extrabold, line breaks from \n */}
        <h2
          className="font-barlow font-extrabold text-[28px] leading-tight tracking-tight text-center mb-3"
          style={{ whiteSpace: "pre-line" }}
        >
          {meta.heading}
        </h2>

        {/* Body */}
        <p className="text-[13px] text-sp-muted2 text-center leading-relaxed mb-5 px-2">
          {meta.body}
        </p>

        {/* Feature list */}
        <div className="bg-sp-bg border border-sp-border rounded-2xl p-4 mb-5 space-y-2.5">
          {meta.features.map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-sp-accent/15 border border-sp-accent/30 flex items-center justify-center shrink-0">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-sp-accent"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[13px] text-sp-text">{feat}</p>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleCta}
          className="w-full bg-sp-accent text-sp-bg font-barlow font-extrabold text-xl tracking-widest uppercase py-4 rounded-2xl transition-opacity hover:opacity-85 active:scale-[0.98] mb-2"
        >
          {meta.cta}
        </button>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="w-full text-center text-[12px] font-barlow font-bold text-sp-muted uppercase tracking-wider py-3"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
