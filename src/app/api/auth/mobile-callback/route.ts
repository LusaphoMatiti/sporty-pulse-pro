import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  // Get the raw signed JWT from the cookie NextAuth just set
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET!,
    raw: true, // returns the raw JWT string
  });

  if (!token) {
    // Auth failed — redirect back to Expo with error
    return NextResponse.redirect("sportypulse://auth?error=no_session");
  }

  // Redirect back to Expo deep link with the token
  return NextResponse.redirect(`sportypulse://auth?token=${token}`);
}
