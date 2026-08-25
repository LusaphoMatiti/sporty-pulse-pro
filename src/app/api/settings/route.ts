import { type NextRequest } from "next/server";
import { getMobileOrWebSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, unauthorized, notFound } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const session = await getMobileOrWebSession(req);
  if (!session?.user?.id) {
    return unauthorized();
  }

  // ASSUMPTION: `experienceLevel` doubles as SettingsData.currentLevel --
  // same field/enum already used in the training-system route, just
  // surfaced under a different name for the profile edit sheet. Confirm
  // this is the same field and not a separate `currentLevel` column.
  //
  // TODO: `plan` -- not confirmed. SettingsScreen does `plan === "PRO"`
  // to decide Pro vs Starter, and there's a payfast integration
  // (/api/payfast/cancel) implying a subscription table. Wire this up to
  // wherever subscription status actually lives -- guessing at the
  // billing schema here would risk mis-reporting Pro status.
  //
  // TODO: `identity` -- not confirmed. SettingsScreen maps this through
  // IDENTITY_LABEL (REBUILD / OPERATOR / EXECUTIVE_PERFORMANCE). Unclear
  // whether this is a stored scalar on User or derived from
  // primaryGoal/trainingLocation/gymTrainingStyle. Flagging rather than
  // guessing at the derivation logic.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      experienceLevel: true,
      // plan: true,      // <- replace with real subscription lookup
      // identity: true,  // <- replace with real field or derivation
    },
  });

  if (!user) {
    return notFound("User");
  }

  return apiSuccess({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
    currentLevel: user.experienceLevel,
    plan: "STARTER", // TODO: replace with real subscription status
    identity: null, // TODO: replace with real value/derivation
  });
}
