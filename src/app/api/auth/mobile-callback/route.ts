//
// After Google OAuth completes, NextAuth redirects here.
// Reads ?redirectUri from the query string (set by mobile-initiate),
// mints a JWT, and fires it back to the app via the correct deep-link scheme.

import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // redirectUri is the deep-link scheme the Expo app passed through mobile-initiate.
  // In dev:  exp+sporty-pulse-expo://expo-development-client/--/auth
  // In prod: sporty-pulse-pro://auth
  const redirectUri =
    req.nextUrl.searchParams.get("redirectUri") ?? "sporty-pulse-pro://auth";

  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!nextAuthToken?.sub) {
    return htmlRedirect(`${redirectUri}?error=no_session`);
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
    return htmlRedirect(`${redirectUri}?error=no_user`);
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

  // Fire the deep link back to the app using whatever scheme it sent us
  const deepLink = `${redirectUri}?token=${token}&isNew=${user.isNewUser}`;
  return htmlRedirect(deepLink);
}

function htmlRedirect(deepLink: string) {
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting…</title>
    <script>window.location.replace(${JSON.stringify(deepLink)});</script>
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
