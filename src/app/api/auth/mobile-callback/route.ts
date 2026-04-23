import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Get the NextAuth token from the cookie
  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!nextAuthToken?.sub) {
    return NextResponse.redirect("sportypulse://auth?error=no_session");
  }

  // Fetch fresh user data
  const user = await prisma.user.findUnique({
    where: { id: nextAuthToken.sub },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      isNewUser: true,
      onboardingComplete: true,
    },
  });

  if (!user) {
    return NextResponse.redirect("sportypulse://auth?error=no_user");
  }

  // Sign with jose HS256 — same as mobile-signin, verified by mobile-auth
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    isNewUser: user.isNewUser,
    onboardingComplete: user.onboardingComplete,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return NextResponse.redirect(`sportypulse://auth?token=${token}`);
}
