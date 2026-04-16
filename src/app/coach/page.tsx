"use client";
import { useSession } from "next-auth/react";
import { Role } from "@/generated/prisma";

export default function CoachPanel() {
  const { data: session } = useSession();

  if (session?.user.role === Role.ATHLETE) return null;

  return <div>Coach-only controls here</div>;
}
