import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encode } from "next-auth/jwt";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    // Encode a JWT token the mobile app can use as a session cookie
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
        isNewUser: user.isNewUser,
      },
      secret: process.env.NEXTAUTH_SECRET!,
    });

    return NextResponse.json({ token, ok: true });
  } catch (err) {
    console.error("[MOBILE_SIGNIN]", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
