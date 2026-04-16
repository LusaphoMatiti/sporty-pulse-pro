"use client";

import { useState } from "react";
import Navbar from "@/components/global/Navbar";
import LockedProgramCard from "@/components/programs/LockedProgram";
import ProgramCard from "@/components/programs/Programscard";
import TrialBanner from "@/components/programs/TrialBanner";
import UpgradePrompt, {
  UpgradeTrigger,
} from "@/components/programs/UpgadePrompt";
import type { WorkoutPlan, Equipment } from "@/generated/prisma";

type AccessContext = {
  isPro: boolean;
  hasActiveTrial: boolean;
  trialExpiresAt: string | null;
  canStartNewProgram: boolean;
  activeInstanceCount: number;
  programCap: number | null; // null = unlimited (Pro)
  activeEquipmentIds: string[];
  expiredEquipmentIds: string[];
  activePlanId: string | null; // the planId of the user's current ACTIVE instance
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

export default function ProgramLibraryClient({
  plans,
  access,
  declaredEquipmentName,
}: Props) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] =
    useState<UpgradeTrigger>("cap_reached");

  const openUpgrade = (trigger: UpgradeTrigger) => {
    setUpgradeTrigger(trigger);
    setUpgradeOpen(true);
  };

  /**
   * Lock reason matrix:
   *
   * FREE (no trial, no equipment)
   *   - Bodyweight          → unlocked (up to cap)
   *   - Any equipment plan  → "upgrade_required"
   *
   * DECLARED TRIAL (hasActiveTrial, activeEquipmentIds populated)
   *   - Bodyweight                     → unlocked (up to cap)
   *   - Program for declared equipment → unlocked (up to cap)
   *   - Program for OTHER equipment    → "upgrade_required"
   *
   * EXPIRED TRIAL
   *   - Bodyweight          → unlocked
   *   - Equipment for expired trial → "trial_expired"
   *   - Other equipment     → "upgrade_required"
   *
   * PRO
   *   - Everything → unlocked (unlimited cap)
   */
  const lockReason = (
    plan: WorkoutPlan & { equipment: Equipment | null },
  ): LockReason | null => {
    const isBodyweight = plan.equipmentId === null;

    // PRO: unlimited, always unlocked
    if (access.isPro) return null;

    if (isBodyweight) {
      return !access.canStartNewProgram ? "cap_reached" : null;
    }

    // Equipment plan ──────────────────────────────────────────────
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

  // "Starter" = never had any trial at all
  const isFreeStarter =
    !access.isPro &&
    !access.hasActiveTrial &&
    access.expiredEquipmentIds.length === 0;

  // Expired trial = had a trial, it's gone, not yet Pro
  const isExpiredTrial =
    !access.isPro &&
    !access.hasActiveTrial &&
    access.expiredEquipmentIds.length > 0;

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
          declaredEquipmentName && (
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

        {/* ── Program cap notice (non-Pro user who hit the cap) ────── */}
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

        {/* ── Plan list ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {plans.map((plan) => {
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

            // Unlocked — render ProgramCard
            const isActive = access.activePlanId === plan.id;
            return (
              <ProgramCard key={plan.id} plan={plan} isActive={isActive} />
            );
          })}
        </div>
      </div>

      {/* ── Upgrade sheet ─────────────────────────────────────────── */}
      <UpgradePrompt
        trigger={upgradeTrigger}
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => {
          setUpgradeOpen(false);
          // router.push("/upgrade");
        }}
      />

      <Navbar />
    </>
  );
}
