import { type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { EquipmentSource } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, purchaseModalShown: true },
  });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const entitlements = await prisma.pendingEntitlement.findMany({
    where: { email: user.email },
  });

  if (entitlements.length > 0) {
    const equipmentIds = entitlements.map((e) => e.equipmentId);

    const existing = await prisma.userEquipment.findMany({
      where: { userId: user.id, equipmentId: { in: equipmentIds } },
      select: { equipmentId: true },
    });
    const existingIds = new Set(existing.map((e) => e.equipmentId));

    // Only the ones actually missing get (re-)granted -- this is what
    // makes the endpoint idempotent and self-healing on every call,
    // regardless of what claimedAt says or how many times this runs.
    const missing = entitlements.filter((e) => !existingIds.has(e.equipmentId));

    for (const e of missing) {
      await prisma.userEquipment.create({
        data: {
          userId: user.id,
          equipmentId: e.equipmentId,
          source: EquipmentSource.PURCHASED,
        },
      });
    }

    // claimedAt is kept as a "first claimed at" timestamp for record
    // -- only set it the first time, never overwritten on re-grants.
    const toMarkClaimed = entitlements
      .filter((e) => e.claimedAt === null)
      .map((e) => e.id);
    if (toMarkClaimed.length > 0) {
      await prisma.pendingEntitlement.updateMany({
        where: { id: { in: toMarkClaimed } },
        data: { claimedAt: new Date() },
      });
    }
  }

  // Read back ALL purchased equipment -- covers what we just (re-)granted
  // above AND rows the grant route wrote directly at purchase time
  // (buyer already had an account then).
  const purchased = await prisma.userEquipment.findMany({
    where: { userId: user.id, source: EquipmentSource.PURCHASED },
    include: { equipment: { select: { id: true, name: true } } },
  });

  const purchasedEquipment = purchased.map((ue) => ue.equipment);
  const showModal = purchasedEquipment.length > 0 && !user.purchaseModalShown;

  if (showModal) {
    await prisma.user.update({
      where: { id: user.id },
      data: { purchaseModalShown: true },
    });
  }

  return Response.json({ purchasedEquipment, showModal });
}
