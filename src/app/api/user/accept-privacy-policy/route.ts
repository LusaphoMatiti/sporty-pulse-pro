import { type NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { privacyPolicyAcceptedAt: new Date() },
  });

  return Response.json({ success: true });
}
