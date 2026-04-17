"use client";

import { useState } from "react";
import Navbar from "@/components/global/Navbar";
import LockedProgramCard from "@/components/programs/LockedProgram";
import ProgramCard from "@/components/programs/Programscard";
import TrialBanner from "@/components/programs/TrialBanner";
import UpgradePrompt, {
  UpgradeTrigger,
} from "@/components/programs/UpgadePrompt";
import type { WorkoutPlan, Equipment, MuscleGroup } from "@/generated/prisma";

type AccessContext = {
  isPro: boolean;
  hasActiveTrial: boolean;
  trialExpiresAt: string | null;
  canStartNewProgram: boolean;
  activeInstanceCount: number;
  programCap: number | null; // null = unlimited (Pro)
  activeEquipmentIds: string[];
  expiredEquipmentIds: string[];
  activePlanId: string | null;
  declaredEquipmentIds: string[];
};

type Props = {
  plans: (WorkoutPlan & { equipment: Equipment | null })[];
  access: AccessContext;
  declaredEquipmentName: string | null;
};

type LockReason =
  | "trial_expired"
  | "cap_reached"
  | "equipment_required"
  | "upgrade_required";

// "ALL" is a UI-only value for the "All" tab
type CategoryFilter = MuscleGroup | "ALL";

const CATEGORIES: { value: CategoryFilter; label: string; emoji: string }[] = [
  { value: "ALL", label: "All", emoji: "⚡" },
  { value: "UPPER", label: "Upper Body", emoji: "💪" },
  { value: "LOWER", label: "Lower Body", emoji: "🦵" },
  { value: "CORE", label: "Core", emoji: "🎯" },
  { value: "FULLBODY", label: "Full Body", emoji: "🔥" },
];

export default function ProgramLibraryClient({
  plans,
  access,
  declaredEquipmentName,
}: Props) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] =
    useState<UpgradeTrigger>("cap_reached");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("ALL");

  const openUpgrade = (trigger: UpgradeTrigger) => {
    setUpgradeTrigger(trigger);
    setUpgradeOpen(true);
  };

  const lockReason = (
    plan: WorkoutPlan & { equipment: Equipment | null },
  ): LockReason | null => {
    const isBodyweight = plan.equipmentId === null;

    if (access.isPro) return null;

    if (isBodyweight) {
      return !access.canStartNewProgram ? "cap_reached" : null;
    }

    const hasAccessToEquipment = access.activeEquipmentIds.includes(
      plan.equipmentId!,
    );

    if (hasAccessToEquipment) {
      return !access.canStartNewProgram ? "cap_reached" : null;
    }
    if (access.expiredEquipmentIds.includes(plan.equipmentId!)) {
      return "trial_expired";
    }

    return "upgrade_required";
  };

  const isFreeStarter =
    !access.isPro &&
    !access.hasActiveTrial &&
    access.expiredEquipmentIds.length === 0;

  const isExpiredTrial =
    !access.isPro &&
    !access.hasActiveTrial &&
    access.expiredEquipmentIds.length > 0;

  // Filter + sort pipeline (same logic as before)
  const visiblePlans = plans
    .sort((a, b) => {
      const aHasEquip = a.equipmentId !== null ? 0 : 1;
      const bHasEquip = b.equipmentId !== null ? 0 : 1;
      return aHasEquip - bHasEquip;
    })
    .filter((plan) => {
      const isBodyweight = plan.equipmentId === null;
      if (isBodyweight) return true;
      if (access.isPro) return true;
      if (access.declaredEquipmentIds.length > 0) {
        return access.declaredEquipmentIds.includes(plan.equipmentId!);
      }
      if (
        access.activeEquipmentIds.length === 0 &&
        access.expiredEquipmentIds.length === 0
      ) {
        return false;
      }
      return true;
    });

  // Pro category filter — only applied when isPro and a non-ALL category is selected
  const filteredPlans =
    access.isPro && activeCategory !== "ALL"
      ? visiblePlans.filter((p) => p.muscleGroup === activeCategory)
      : visiblePlans;

  return (
    <>
      <div className="min-h-screen bg-sp-bg text-sp-text font-dm pb-28 px-5 pt-6 space-y-4 max-w-md mx-auto">
        <h1 className="font-barlow font-extrabold text-[30px] tracking-tight">
          Programs
        </h1>

        {/* ── Pro badge banner ──────────────────────────────────────── */}
        {access.isPro && (
          <div className="bg-sp-accent/8 border border-sp-accent/20 rounded-2xl px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sp-accent/15 border border-sp-accent/30 flex items-center justify-center text-base shrink-0">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sp-accent">
                You&apos;re on Pro
              </p>
              <p className="text-[12px] text-sp-muted leading-snug">
                All programs unlocked · Unlimited active programs
              </p>
            </div>
            <span className="text-[10px] font-barlow font-bold tracking-widest uppercase border border-sp-accent/30 text-sp-accent rounded-lg px-2.5 py-1 shrink-0">
              Pro
            </span>
          </div>
        )}

        {/* ── Active trial banner ───────────────────────────────────── */}
        {access.hasActiveTrial &&
          access.trialExpiresAt &&
          declaredEquipmentName &&
          !access.isPro && (
            <TrialBanner
              trialExpiresAt={access.trialExpiresAt}
              equipmentName={declaredEquipmentName}
              onUpgrade={() => openUpgrade("trial_expired")}
            />
          )}

        {/* ── Free-starter Pro upsell banner ────────────────────────── */}
        {isFreeStarter && (
          <div className="bg-sp-surface border border-sp-accent/20 rounded-2xl px-4 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-sp-accent/10 border border-sp-accent/20 flex items-center justify-center text-lg shrink-0">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sp-text">
                You&apos;re on the Starter plan
              </p>
              <p className="text-[12px] text-sp-muted leading-snug mb-2">
                Bodyweight programs are yours for free. Upgrade to Pro for
                unlimited programs and equipment access.
              </p>
              <button
                onClick={() => openUpgrade("cap_reached")}
                className="text-[12px] font-barlow font-bold text-sp-accent uppercase tracking-wider"
              >
                Upgrade to Pro →
              </button>
            </div>
          </div>
        )}

        {/* ── Expired-trial banner ──────────────────────────────────── */}
        {isExpiredTrial && (
          <div className="bg-sp-surface border border-red-500/20 rounded-2xl px-4 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-lg shrink-0">
              ⏱
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sp-text">
                Your equipment trial has ended
              </p>
              <p className="text-[12px] text-sp-muted leading-snug mb-2">
                Bodyweight programs are still yours for free. Upgrade to Pro for
                unlimited programs and all equipment access.
              </p>
              <button
                onClick={() => openUpgrade("trial_expired")}
                className="text-[12px] font-barlow font-bold text-sp-accent uppercase tracking-wider"
              >
                Upgrade to Pro →
              </button>
            </div>
          </div>
        )}

        {/* ── Program cap notice ────────────────────────────────────── */}
        {!access.canStartNewProgram && !access.isPro && !isFreeStarter && (
          <div className="bg-sp-surface border border-sp-border rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-sp-text">
                {access.activeInstanceCount} of {access.programCap} programs
                active
              </p>
              <p className="text-[12px] text-sp-muted2">
                Upgrade for unlimited
              </p>
            </div>
            <button
              onClick={() => openUpgrade("cap_reached")}
              className="bg-sp-accent text-sp-bg font-barlow font-bold text-[12px] tracking-widest uppercase rounded-xl px-3 py-2 hover:opacity-85 transition-opacity"
            >
              Go Pro
            </button>
          </div>
        )}

        {/* ── Pro-only category tabs ────────────────────────────────── */}
        {access.isPro && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={[
                    "flex items-center gap-1.5 shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-barlow font-bold tracking-wider uppercase transition-all",
                    isSelected
                      ? "bg-sp-accent text-sp-bg"
                      : "bg-sp-surface border border-sp-border text-sp-muted hover:border-sp-accent/40 hover:text-sp-text",
                  ].join(" ")}
                >
                  <span className="text-[13px] leading-none">{cat.emoji}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Plan list ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filteredPlans.length === 0 ? (
            <div className="text-center py-10 text-sp-muted text-sm">
              No programs in this category yet.
            </div>
          ) : (
            filteredPlans.map((plan) => {
              const reason = lockReason(plan);

              if (reason) {
                return (
                  <LockedProgramCard
                    key={plan.id}
                    plan={plan}
                    reason={reason}
                    onUpgrade={() => openUpgrade(reason as UpgradeTrigger)}
                  />
                );
              }

              const isActive = access.activePlanId === plan.id;
              return (
                <ProgramCard key={plan.id} plan={plan} isActive={isActive} />
              );
            })
          )}
        </div>
      </div>

      {/* ── Upgrade sheet ─────────────────────────────────────────── */}
      <UpgradePrompt
        trigger={upgradeTrigger}
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => {
          setUpgradeOpen(false);
        }}
      />

      <Navbar />
    </>
  );
}
