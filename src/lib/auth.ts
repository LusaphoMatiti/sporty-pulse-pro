import { NextAuthOptions, User } from "next-auth";
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma";
import { reconcilePendingEntitlements } from "@/lib/reconcile-entitlements";

interface ExtendedUser extends User {
  id: string;
  role: Role;
  isNewUser: boolean;
  onboardingComplete: boolean;
}

interface ExtendedJWT extends JWT {
  id: string;
  role: Role;
  isNewUser: boolean;
  onboardingComplete: boolean;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<ExtendedUser | null> {
        if (!credentials?.email || !credentials?.password)
          throw new Error("Email and password are required");

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            isNewUser: true,
            onboardingComplete: true,
          },
        });

        if (!user || !user.password)
          throw new Error("No account found — try signing in with Google");

        const match = await bcrypt.compare(credentials.password, user.password);
        if (!match) throw new Error("Incorrect password");

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        try {
          await reconcilePendingEntitlements(user.id, user.email);
        } catch (error) {
          console.error("Failed to reconcile pending entitlements:", error);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isNewUser: user.isNewUser,
          onboardingComplete: user.onboardingComplete,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
          select: {
            id: true,
            role: true,
            isNewUser: true,
            onboardingComplete: true,
          },
        });

        const dbUser = await prisma.user.upsert({
          where: { email: user.email! },
          update: { name: user.name, lastLoginAt: new Date() },
          create: {
            email: user.email!,
            name: user.name,
            role: Role.ATHLETE,
            isNewUser: true,
            onboardingComplete: false,
          },
          select: {
            id: true,
            role: true,
            isNewUser: true,
            onboardingComplete: true,
          },
        });

        await prisma.subscription.upsert({
          where: { userId: dbUser.id },
          update: {},
          create: { userId: dbUser.id, plan: "FREE", status: "active" },
        });

        try {
          await reconcilePendingEntitlements(dbUser.id, user.email!);
        } catch (error) {
          console.error("Failed to reconcile pending entitlements:", error);
        }

        const ext = user as ExtendedUser;
        ext.id = dbUser.id;
        ext.role = dbUser.role;
        ext.isNewUser = !existing;
        ext.onboardingComplete = existing
          ? (existing.onboardingComplete ?? false)
          : false;
      }
      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      const extToken = token as ExtendedJWT;

      if (account && user) {
        const extUser = user as ExtendedUser;
        extToken.id = extUser.id ?? token.sub ?? "";
        extToken.role = extUser.role ?? Role.ATHLETE;
        extToken.isNewUser = extUser.isNewUser ?? false;
        extToken.onboardingComplete = extUser.onboardingComplete ?? false;
      }

      if (trigger === "update" && session) {
        if (session.name) extToken.name = session.name;
        if (session.image) extToken.picture = session.image;
        if (session.onboardingComplete !== undefined)
          extToken.onboardingComplete = session.onboardingComplete;
        if (session.isNewUser !== undefined)
          extToken.isNewUser = session.isNewUser;
      }

      return extToken;
    },

    async session({ session, token }) {
      const extToken = token as ExtendedJWT;
      if (extToken && session.user) {
        session.user.id = extToken.id;
        session.user.role = extToken.role;
        session.user.isNewUser = extToken.isNewUser;
        session.user.onboardingComplete = extToken.onboardingComplete;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // 1. Always allow deep-link scheme through (final step back to app)
      if (url.startsWith("sporty-pulse-pro://")) return url;

      // 2. Always allow mobile-callback through
      if (url.startsWith(`${baseUrl}/api/auth/mobile-callback`)) return url;

      // 3. Standard web redirects — do NOT fall through to mobile-callback
      //    for web users. The mobile flow is handled by the cookie in
      //    the /api/auth/mobile-initiate route, not here.
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;

      return baseUrl;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
