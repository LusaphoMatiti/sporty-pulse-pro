// src/lib/getSession.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { Role } from "@/generated/prisma";

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
  // 1. Try cookie-based session first (web)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session as MobileSession;

  // 2. Fall back to Bearer token (Expo)
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!bearer) return null;

  const decoded = await getToken({
    req: {
      headers: { cookie: `next-auth.session-token=${bearer}` },
    } as unknown as NextRequest,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!decoded?.sub) return null;

  return {
    user: {
      id: decoded.id as string,
      email: decoded.email as string,
      role: decoded.role as Role,
      isNewUser: decoded.isNewUser as boolean,
      onboardingComplete: decoded.onboardingComplete as boolean,
    },
  };
}
