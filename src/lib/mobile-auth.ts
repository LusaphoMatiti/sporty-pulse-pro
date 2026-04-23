import { decode } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getMobileOrWebSession(req: Request) {
  // Try Bearer token first (mobile)
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const payload = await decode({
        token,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      if (!payload?.sub) return null;
      return {
        user: {
          id: payload.sub,
          email: payload.email as string,
          name: payload.name as string,
          image: payload.image as string,
          role: payload.role as string,
        },
      };
    } catch {
      return null;
    }
  }

  // Fall back to NextAuth session (web)
  return getServerSession(authOptions);
}
