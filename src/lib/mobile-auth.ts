import { jwtVerify } from "jose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getMobileOrWebSession(req: Request) {
  const auth = req.headers.get("authorization");
  console.log("[mobile-auth] Authorization header:", auth?.slice(0, 30));

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      console.log("[mobile-auth] payload.sub:", payload.sub);
      if (!payload.sub) return null;
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
