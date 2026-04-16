import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not allowed in production" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "?email= param required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: `No user found with email: ${email}` },
      { status: 404 },
    );
  }

  await prisma.$transaction([
    prisma.workoutLog.deleteMany({ where: { userId: user.id } }),
    prisma.planInstance.deleteMany({ where: { userId: user.id } }),
    prisma.userEquipment.deleteMany({ where: { userId: user.id } }),
    prisma.subscription.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return NextResponse.json({
    ok: true,
    deleted: email,
    message: "User fully reset. Register again to test new user flow.",
  });
}
