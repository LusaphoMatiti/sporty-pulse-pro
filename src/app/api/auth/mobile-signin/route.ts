import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import {
  apiSuccess,
  unauthorized,
  validationError,
  internalError,
} from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.password) {
      return validationError("Email and password are required");
    }

    const { email, password } = body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        isNewUser: true,
        onboardingComplete: true,
      },
    });

    if (!user || !user.password) {
      return unauthorized("Invalid credentials");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return unauthorized("Invalid credentials");
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const token = await new SignJWT({
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isNewUser: user.isNewUser,
      onboardingComplete: user.onboardingComplete,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    // Awaited — fire-and-forget was a silent bug
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return apiSuccess({ token });
  } catch (err) {
    console.error("[mobile-signin] error:", err);
    return internalError(err);
  }
}
