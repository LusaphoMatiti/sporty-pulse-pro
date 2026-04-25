import { NextAuthOptions, User } from "next-auth";
import { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma";

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
    //  signIn
    // Runs before jwt(). Upserts the Google user and stamps the flags
    // directly onto the user object so jwt() doesn't need a second
    // DB round-trip on first sign-in.
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

        // Ensure every Google user always has a subscription row
        await prisma.subscription.upsert({
          where: { userId: dbUser.id },
          update: {},
          create: { userId: dbUser.id, plan: "FREE", status: "active" },
        });

        const ext = user as ExtendedUser;
        ext.id = dbUser.id;
        ext.role = dbUser.role;
        // isNewUser is true only for brand-new accounts
        ext.isNewUser = !existing;
        ext.onboardingComplete = existing
          ? (existing.onboardingComplete ?? false)
          : false;
      }
      return true;
    },

    // ── jwt ─────────────────────────────────────────────────────────
    async jwt({ token, user, account, trigger, session }) {
      const extToken = token as ExtendedJWT;

      // A. First sign-in — user object is present; copy flags onto token.
      //    This is the ONLY time we touch the DB (via signIn() above).
      //    All subsequent requests carry the flags on the token itself.
      if (account && user) {
        const extUser = user as ExtendedUser;
        extToken.id = extUser.id ?? token.sub ?? "";
        extToken.role = extUser.role ?? Role.ATHLETE;
        extToken.isNewUser = extUser.isNewUser ?? false;
        extToken.onboardingComplete = extUser.onboardingComplete ?? false;
      }

      // B. Session update — fired when the client calls useSession().update().
      //    The onboarding page calls this after the API route succeeds so
      //    middleware sees onboardingComplete: true on the next request
      //    without waiting for a full sign-in cycle.
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

    //  session
    // Exposes the token flags on the client-side session object so
    // components and server pages can read them via getServerSession().
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
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
