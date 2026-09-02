import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, unauthorized } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { trainingLocation: true },
  });

  return apiSuccess({
    trainingLocation: user?.trainingLocation ?? null,
  });
}
