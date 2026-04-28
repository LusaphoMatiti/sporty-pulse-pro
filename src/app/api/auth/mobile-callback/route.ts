// src/app/api/auth/mobile-callback/route.ts
//
// After Google OAuth completes, NextAuth redirects here (because
// mobile-initiate set this as the callbackUrl).
// We mint a short-lived JWT and fire a deep-link back to the app.

import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // If the mobile cookie isn't present this isn't a mobile OAuth flow —
  // redirect web users to the app home instead.
  const isMobile = req.cookies.get("sp_mobile_auth")?.value === "1";
  if (!isMobile) {
    return NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL!));
  }

  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!nextAuthToken?.sub) {
    return htmlRedirect("sporty-pulse-pro://auth?error=no_session");
  }

  const user = await prisma.user.findUnique({
    where: { id: nextAuthToken.sub },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      isNewUser: true,
      onboardingComplete: true,
    },
  });

  if (!user) {
    return htmlRedirect("sporty-pulse-pro://auth?error=no_user");
  }

  // Clear isNewUser once onboarding is done
  if (user.isNewUser && user.onboardingComplete) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isNewUser: false },
    });
    user.isNewUser = false;
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    isNewUser: user.isNewUser,
    onboardingComplete: user.onboardingComplete,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  // Clear the mobile cookie
  const deepLink = `sporty-pulse-pro://auth?token=${token}&isNew=${user.isNewUser}`;
  const res = htmlRedirect(deepLink);
  res.headers.append(
    "Set-Cookie",
    "sp_mobile_auth=; Max-Age=0; Path=/; HttpOnly",
  );
  return res;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function htmlRedirect(deepLink: string) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <script>window.location.href = ${JSON.stringify(deepLink)};</script>
  </head>
  <body>
    <p>Redirecting back to the app…</p>
    <p>If nothing happens, <a href="${deepLink}">tap here</a>.</p>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
