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

  // Claim anything still pending under this email (buyer signed up
  // after purchasing, so the grant route queued it instead of
  // writing UserEquipment directly).
  const pending = await prisma.pendingEntitlement.findMany({
    where: { email: user.email, claimedAt: null },
  });

  for (const p of pending) {
    await prisma.userEquipment.upsert({
      where: {
        userId_equipmentId: { userId: user.id, equipmentId: p.equipmentId },
      },
      update: {},
      create: {
        userId: user.id,
        equipmentId: p.equipmentId,
        source: EquipmentSource.PURCHASED,
      },
    });
  }

  if (pending.length > 0) {
    await prisma.pendingEntitlement.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { claimedAt: new Date() },
    });
  }

  // Now read back ALL purchased equipment -- covers both what we just
  // claimed above AND rows the grant route wrote directly at purchase
  // time (buyer already had an account then).
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
