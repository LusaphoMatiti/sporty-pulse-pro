// src/app/api/auth/mobile-callback/route.ts
//
// After Google OAuth completes, NextAuth redirects here.
// Mints a short-lived JWT and fires a deep-link back to the Expo app.

import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
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

  // Clear isNewUser once onboarding is done so returning users
  // are never routed to the welcome/onboarding flow again.
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

  return htmlRedirect(
    `sporty-pulse-pro://auth?token=${token}&isNew=${user.isNewUser}`,
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────
// Returns an HTML page that immediately redirects to the deep-link URL.
// openAuthSessionAsync intercepts any URL matching the redirectUrl prefix
// ("sporty-pulse-pro://") and hands it back to the Expo app automatically.
function htmlRedirect(deepLink: string) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <script>
      window.location.replace(${JSON.stringify(deepLink)});
    </script>
  </head>
  <body>
    <p>Redirecting back to the app…</p>
    <p>If nothing happens, <a href="${deepLink}">tap here</a>.</p>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    },
  });
}
