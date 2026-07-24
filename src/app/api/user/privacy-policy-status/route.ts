import { type NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return Response.json(null, { status: 401, statusText: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingComplete: true, privacyPolicyAcceptedAt: true },
  });

  if (!user) {
    return Response.json(null, { status: 404, statusText: "Not Found" });
  }

  const needsAcceptance =
    user.onboardingComplete && !user.privacyPolicyAcceptedAt;

  return Response.json({ needsAcceptance });
}
