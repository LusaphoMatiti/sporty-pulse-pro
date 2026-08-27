import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  // redirectUri is the deep-link scheme the Expo app passed through mobile-initiate.
  // In dev:  exp+sporty-pulse-expo://expo-development-client/--/auth
  // In prod: sporty-pulse-pro://auth
  const redirectUri =
    req.nextUrl.searchParams.get("redirectUri") ?? "sporty-pulse-pro://auth";

  // Set by mobile-initiate only when RegisterScreen kicked off this flow.
  // LoginScreen never sends this, so its requests are unaffected below.
  const intent = req.nextUrl.searchParams.get("intent");

  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!nextAuthToken?.sub) {
    return htmlRedirect(`${redirectUri}?error=no_session`);
  }

  let user = await prisma.user.findUnique({
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

  // auth.ts's signIn callback deliberately does NOT create a User row for a
  // first-time Google sign-in — it leaves `sub` as the raw Google profile id
  // so this lookup misses and we land here. For Login that's the desired
  // "no account" rejection below. For Register, create the account now,
  // mirroring /api/auth/register's plan for a password sign-up.
  if (!user && intent === "register" && nextAuthToken.email) {
    try {
      user = await prisma.user.create({
        data: {
          name: (nextAuthToken.name as string | undefined) ?? null,
          email: nextAuthToken.email as string,
          image: (nextAuthToken.picture as string | undefined) ?? null,
          role: Role.ATHLETE,
          isNewUser: true,
          onboardingComplete: false,
          subscription: {
            create: { plan: "FREE", status: "active" },
          },
        },
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
    } catch (err) {
      console.error("[mobile-callback] Google sign-up create failed:", err);
      return htmlRedirect(`${redirectUri}?error=no_user`);
    }
  }

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
    id: user.id,
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
