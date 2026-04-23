// src/lib/getSession.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
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
  // 1. Cookie session (web)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session as MobileSession;

  // 2. Bearer token (Expo)
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!bearer) return null;

  try {
    // Try NextAuth getToken first (Google OAuth path)
    const decoded = await getToken({
      req: {
        headers: { cookie: `next-auth.session-token=${bearer}` },
      } as unknown as NextRequest,
      secret: process.env.NEXTAUTH_SECRET!,
    });

    if (decoded?.id) {
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
  } catch {}

  try {
    // Fall back to jose verification (credentials path)
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const { payload } = await jwtVerify(bearer, secret);

    if (payload?.id) {
      return {
        user: {
          id: payload.id as string,
          email: payload.email as string,
          role: payload.role as Role,
          isNewUser: payload.isNewUser as boolean,
          onboardingComplete: payload.onboardingComplete as boolean,
        },
      };
    }
  } catch {}

  return null;
}
