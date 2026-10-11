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

  // 2. Bearer token (Expo — both credentials and Google OAuth path)
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!bearer) return null;

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const { payload } = await jwtVerify(bearer, secret);

    if (payload?.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.id as string },
        select: { tokenVersion: true },
      });
      if (
        !dbUser ||
        dbUser.tokenVersion !== ((payload.tv as number | undefined) ?? 0)
      ) {
        return null;
      }
    }
  } catch (e) {
    console.error("[getSession] jwtVerify failed:", e);
  }

  return null;
}
