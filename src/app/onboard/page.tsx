import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.onboardingComplete) redirect("/");

  const equipment = await prisma.equipment.findMany({
    orderBy: { name: "asc" },
  });

  const grouped = {
    fullbody: equipment.filter((e) => e.category === "fullbody"),
    upper: equipment.filter((e) => e.category === "upper"),
    lower: equipment.filter((e) => e.category === "lower"),
    core: equipment.filter((e) => e.category === "core"),
  };

  return <OnboardingClient grouped={grouped} />;
}
