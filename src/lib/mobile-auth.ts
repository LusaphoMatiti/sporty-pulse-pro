import { jwtVerify } from "jose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getMobileOrWebSession(req: Request) {
  const auth = req.headers.get("authorization");

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      if (!payload.sub) return null;
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true },
      });
      if (
        !dbUser ||
        dbUser.tokenVersion !== ((payload.tv as number | undefined) ?? 0)
      ) {
        return null;
      }
      return {
        user: {
          id: payload.sub,
          email: payload.email as string,
          name: payload.name as string,
          image: (payload.image as string) ?? null,
          role: payload.role as string,
        },
      };
    } catch (e) {
      console.error("[mobile-auth] jwtVerify failed:", e);
      return null;
    }
  }

  return getServerSession(authOptions);
}
