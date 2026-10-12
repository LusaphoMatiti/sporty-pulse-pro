import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { Role } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

interface MobileSession {
  user: {
    id: string;
    email: string;
    role: Role;
    isNewUser: boolean;
    onboardingComplete: boolean;
  };
}

export async function getSessionFromRequest(
  req: NextRequest,
): Promise<MobileSession | null> {
  // 1. Cookie session (web)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session as MobileSession;

  // 2. Bearer token (Expo)
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const bearer = header.slice(7);

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const { payload } = await jwtVerify(bearer, secret);

    const userId = (payload.id ?? payload.sub) as string | undefined;
    if (!userId) return null;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isNewUser: true,
        onboardingComplete: true,
        tokenVersion: true,
      },
    });

    if (
      !dbUser ||
      dbUser.tokenVersion !== ((payload.tv as number | undefined) ?? 0)
    ) {
      return null;
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        isNewUser: dbUser.isNewUser,
        onboardingComplete: dbUser.onboardingComplete,
      },
    };
  } catch (e) {
    console.error("[getSession] jwtVerify failed:", e);
    return null;
  }
}
