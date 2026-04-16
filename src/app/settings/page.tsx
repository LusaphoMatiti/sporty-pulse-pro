import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Settings from "@/components/global/Settings";
import { prisma } from "@/lib/prisma";
import { InstanceStatus } from "@/generated/prisma";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const instance = await prisma.planInstance.findFirst({
    where: { userId: session.user.id, status: InstanceStatus.ACTIVE },
    select: { level: true },
  });

  const currentLevel = (instance?.level ?? "BEGINNER") as
    | "BEGINNER"
    | "INTERMEDIATE"
    | "ADVANCED";

  return <Settings session={session} currentLevel={currentLevel} />;
}
