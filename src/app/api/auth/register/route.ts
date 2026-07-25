import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    // NOTE: subscription is created ONCE here, via the nested `create`.
    // A second top-level `prisma.subscription.create({ userId: newUser.id, ... })`
    // used to run right after this and violate Subscription.userId's @unique
    // constraint (one user can only ever have one subscription row) — that
    // call has been removed.
    const newUser = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        role: Role.ATHLETE,
        isNewUser: true,
        onboardingComplete: false,
        subscription: {
          create: {
            plan: "FREE",
            status: "active",
          },
        },
      },
    });

    // Sign a session JWT immediately so the mobile app can auto-login the
    // new user right after registering, instead of bouncing them back to
    // the Login screen. Mirrors the token shape used by mobile-signin.
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const token = await new SignJWT({
      id: newUser.id,
      sub: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      isNewUser: newUser.isNewUser,
      onboardingComplete: newUser.onboardingComplete,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    return NextResponse.json({ token }, { status: 201 });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
