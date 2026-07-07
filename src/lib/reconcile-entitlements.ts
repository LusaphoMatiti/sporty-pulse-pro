import { prisma } from "@/lib/prisma";
import { EquipmentSource } from "@/generated/prisma/client";

/**
 * Checks for any equipment purchased on Store before this person had a
 * Pro account, and grants it now that they do. Safe to call on every
 * sign-in, not just registration -- once a PendingEntitlement is claimed
 * (claimedAt is set), it won't be picked up again, so repeat calls are
 * cheap no-ops.
 */

export async function reconcilePendingEntitlements(
  userId: string,
  email: string,
) {
  const pending = await prisma.pendingEntitlement.findMany({
    where: { email, claimedAt: null },
  });

  if (pending.length === 0) return;

  for (const entitlement of pending) {
    await prisma.userEquipment.upsert({
      where: {
        userId_equipmentId: { userId, equipmentId: entitlement.equipmentId },
      },
      update: {}, // already has it -- leave as-is
      create: {
        userId,
        equipmentId: entitlement.equipmentId,
        source: EquipmentSource.PURCHASED,
      },
    });

    // Keep the row (rather than delete it) -- it's a useful audit trail
    // of "this was a Store purchase," now marked as claimed.
    await prisma.pendingEntitlement.update({
      where: { id: entitlement.id },
      data: { claimedAt: new Date() },
    });
  }
}
