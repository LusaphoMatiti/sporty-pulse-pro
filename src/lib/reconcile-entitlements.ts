import { prisma } from "@/lib/prisma";
import { EquipmentSource, Plan } from "@/generated/prisma/client";

/**
 * Checks for any equipment purchased on Store before this person had a
 * Pro account, and grants it now that they do. Safe to call on every
 * sign-in, not just registration.
 *
 * Re-checks actual UserEquipment existence on every call rather than
 * trusting claimedAt as a gate -- claimedAt only proves a row was once
 * created, not that it still exists (e.g. if a User is ever deleted and
 * recreated under the same email, UserEquipment cascades away but
 * PendingEntitlement -- no FK to User -- survives with claimedAt already
 * set, permanently blocking re-granting under the old logic). Same class
 * of bug already found and fixed in check-purchases; applying the same
 * fix here for consistency.
 */
export async function reconcilePendingEntitlements(
  userId: string,
  email: string,
) {
  const pending = await prisma.pendingEntitlement.findMany({
    where: { email },
  });

  if (pending.length === 0) return;

  let grantedAny = false;

  for (const entitlement of pending) {
    const existing = await prisma.userEquipment.findUnique({
      where: {
        userId_equipmentId: { userId, equipmentId: entitlement.equipmentId },
      },
    });

    if (!existing) {
      await prisma.userEquipment.create({
        data: {
          userId,
          equipmentId: entitlement.equipmentId,
          source: EquipmentSource.PURCHASED,
        },
      });
    }
    grantedAny = true;

    // Keep the row (rather than delete it) -- useful audit trail of
    // "this was a Store purchase." claimedAt is a first-granted-at
    // timestamp only now, set once, never used as a gate.
    if (!entitlement.claimedAt) {
      await prisma.pendingEntitlement.update({
        where: { id: entitlement.id },
        data: { claimedAt: new Date() },
      });
    }
  }

  // Keep Subscription.plan in sync with real ownership -- same fix as
  // the grant route. Never downgrades an existing PRO subscriber.
  if (grantedAny) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true },
    });

    if (subscription?.plan !== Plan.PRO) {
      await prisma.subscription.upsert({
        where: { userId },
        update: { plan: Plan.EQUIPMENT },
        create: { userId, plan: Plan.EQUIPMENT, status: "active" },
      });
    }
  }
}
