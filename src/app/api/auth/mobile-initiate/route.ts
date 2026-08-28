import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { Role, Prisma } from "@/generated/prisma";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  isNewUser: true,
  onboardingComplete: true,
} as const;

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
    select: USER_SELECT,
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
        select: USER_SELECT,
      });
    } catch (err: unknown) {
      // This route is a GET handler that performs a write, and GET requests
      // to an OAuth callback URL routinely get hit more than once for the
      // same sign-up (Custom Tabs / SFSafariViewController prefetch, the
      // app's deep-link listener racing the WebView redirect, a dropped
      // connection triggering a client retry, etc).
      //
      // Because `nextAuthToken.sub` is the raw Google profile id (never the
      // row's DB id — see comment above), a second hit for the *same*
      // registration will land in this branch again and collide on the
      // unique email constraint (Prisma error code P2002). That's not a
      // real failure — the account was already created a moment ago by the
      // first hit — so recover by fetching it instead of hard-failing.
      const isDuplicateEmail =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002";

      if (isDuplicateEmail) {
        user = await prisma.user.findUnique({
          where: { email: nextAuthToken.email as string },
          select: USER_SELECT,
        });
      }

      if (!user) {
        console.error("[mobile-callback] Google sign-up create failed:", err);
        return htmlRedirect(`${redirectUri}?error=no_user`);
      }
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
