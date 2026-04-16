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
    // Runs BEFORE jwt(). We upsert the Google user here and stamp the
    // isNewUser / onboardingComplete flags directly onto the `user` object
    // so jwt() can read them without a second DB round-trip.
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

        // Stamp everything onto user so jwt() doesn't need to re-query
        const ext = user as ExtendedUser;
        ext.id = dbUser.id;
        ext.role = dbUser.role;
        // isNewUser: true only if this is a brand-new account
        ext.isNewUser = !existing;
        ext.onboardingComplete = existing
          ? (existing.onboardingComplete ?? false)
          : false;
      }
      return true;
    },

    //  jwt
    async jwt({ token, user, account, trigger, session }) {
      const extToken = token as ExtendedJWT;

      //  First sign-in .
      if (account && user) {
        const extUser = user as ExtendedUser;
        extToken.id = extUser.id ?? token.sub ?? "";
        extToken.role = extUser.role ?? Role.ATHLETE;
        extToken.isNewUser = extUser.isNewUser ?? false;
        extToken.onboardingComplete = extUser.onboardingComplete ?? false;
      }

      // B. Subsequent requests (no account)
      if (!account && extToken.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: extToken.id },
          select: { isNewUser: true, onboardingComplete: true },
        });
        extToken.isNewUser = dbUser?.isNewUser ?? false;
        extToken.onboardingComplete = dbUser?.onboardingComplete ?? false;
      }

      // C. Session update
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
