import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isNewUser: true, onboardingComplete: true },
  });

  if (!user) redirect("/login");

  if (user.isNewUser) redirect("/welcome");
  if (!user.onboardingComplete) redirect("/onboard");
  redirect("/");
}
