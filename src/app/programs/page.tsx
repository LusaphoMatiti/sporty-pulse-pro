import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserAccess } from "@/lib/access";
import { InstanceStatus } from "@/generated/prisma";
import ProgramLibraryClient from "./ProgramLibraryClient";

export default async function ProgramsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;

  //  Access context
  const access = await getUserAccess({ userId });

  //  All plans
  const plans = await prisma.workoutPlan.findMany({
    include: { equipment: true },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });

  //  Declared equipment name
  const declaredEquipment = await prisma.userEquipment.findFirst({
    where: { userId, source: "DECLARED" },
    include: { equipment: true },
  });

  //  Active + expired equipment IDs
  const allUserEquipment = await prisma.userEquipment.findMany({
    where: { userId },
    select: { equipmentId: true, source: true, trialExpiresAt: true },
  });

  const activeEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "PURCHASED" ||
        (e.source === "DECLARED" &&
          e.trialExpiresAt &&
          e.trialExpiresAt > new Date()),
    )
    .map((e) => e.equipmentId);

  const expiredEquipmentIds = allUserEquipment
    .filter(
      (e) =>
        e.source === "DECLARED" &&
        e.trialExpiresAt &&
        e.trialExpiresAt <= new Date(),
    )
    .map((e) => e.equipmentId);

  // ── Active plan instance (to highlight the card already running) ─
  const activeInstance = await prisma.planInstance.findFirst({
    where: { userId, status: InstanceStatus.ACTIVE },
    select: { planId: true },
  });

  return (
    <ProgramLibraryClient
      plans={plans}
      access={{
        isPro: access.isPro,
        hasActiveTrial: access.hasActiveTrial,
        trialExpiresAt: access.trialExpiresAt?.toISOString() ?? null,
        canStartNewProgram: access.canStartNewProgram,
        activeInstanceCount: access.activeInstanceCount,
        programCap: access.isPro ? null : access.programCap,
        activeEquipmentIds,
        expiredEquipmentIds,
        activePlanId: activeInstance?.planId ?? null,
      }}
      declaredEquipmentName={declaredEquipment?.equipment.name ?? null}
    />
  );
}
