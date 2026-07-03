import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { EquipmentSource } from "@/generated/prisma/client";

// Store calls this after a PayFast payment confirms.
// Not public-facing — protected by a shared secret, not user auth.

const grantRequestSchema = z.object({
  email: z.string().email(),
  storeProductIds: z.array(z.string()).min(1),
});

export const POST = async (req: NextRequest) => {
  // ── 1. Auth: shared secret between Store and Pro ──────────────
  const expectedSecret = process.env.STORE_BRIDGE_SECRET;

  if (!expectedSecret) {
    console.error("STORE_BRIDGE_SECRET is not set on Pro");
    return Response.json(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  // ── 2. Validate the request body ───────────────────────────────
  const rawBody = await req.json();
  const parsed = grantRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, storeProductIds } = parsed.data;

  try {
    // ── 3. Translate Store product IDs -> Pro equipment IDs ───────
    const mappings = await prisma.productEquipmentMap.findMany({
      where: { storeProductId: { in: storeProductIds } },
    });

    const mappedProductIds = new Set(mappings.map((m) => m.storeProductId));
    const unmapped = storeProductIds.filter((id) => !mappedProductIds.has(id));
    if (unmapped.length > 0) {
      // Not a hard failure -- but worth knowing about, since it means
      // a product was sold with no equipment mapping configured yet.
      console.warn("No ProductEquipmentMap entry for:", unmapped);
    }

    if (mappings.length === 0) {
      return Response.json({ granted: [], pending: [] });
    }

    const equipmentIds = mappings.map((m) => m.equipmentId);

    // ── 4. Does this email already have a Pro account? ────────────
    const user = await prisma.user.findUnique({ where: { email } });

    const granted: string[] = [];
    const pending: string[] = [];

    if (user) {
      for (const equipmentId of equipmentIds) {
        await prisma.userEquipment.upsert({
          where: {
            userId_equipmentId: { userId: user.id, equipmentId },
          },
          update: {}, // already exists -- leave as-is
          create: {
            userId: user.id,
            equipmentId,
            source: EquipmentSource.PURCHASED,
          },
        });
        granted.push(equipmentId);
      }
    } else {
      for (const equipmentId of equipmentIds) {
        await prisma.pendingEntitlement.upsert({
          where: {
            email_equipmentId: { email, equipmentId },
          },
          update: {}, // already pending -- leave as-is
          create: {
            email,
            equipmentId,
            source: "store_purchase",
          },
        });
        pending.push(equipmentId);
      }
    }

    return Response.json({ granted, pending });
  } catch (error) {
    console.error(error);
    return Response.json(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
};
