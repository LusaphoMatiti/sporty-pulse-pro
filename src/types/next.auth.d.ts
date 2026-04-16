import { DefaultSession } from "next-auth";
import { Role } from "@/generated/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      isNewUser: boolean;
      onboardingComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    isNewUser: boolean;
    onboardingComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isNewUser: boolean;
    onboardingComplete: boolean;
  }
}
