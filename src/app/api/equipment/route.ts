export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const equipment = await prisma.equipment.findMany({
    where: {
      // Exclude the internal "Bodyweight" record — it's not real equipment
      name: { not: "Bodyweight" },
    },
    select: {
      id: true,
      name: true,
      category: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ equipment });
}
