import { NextResponse } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [user, activeInstance, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, role: true },
    }),
    prisma.planInstance.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { level: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    }),
  ]);

  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const plan: string =
    subscription?.status === "active" ? subscription.plan : "FREE";

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      plan: plan as "FREE" | "EQUIPMENT" | "PRO",
      isNewUser: false,
      experienceLevel: activeInstance?.level ?? null,
    },
    currentLevel: activeInstance?.level ?? "BEGINNER",
    plan,
  });
}
