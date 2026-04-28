// src/app/api/auth/mobile-initiate/route.ts
//
// Called by the Expo app instead of /api/auth/signin/google.
// Sets a cookie so mobile-callback knows to mint a JWT,
// then redirects straight to Google — bypassing the web /login page.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL!;

  // The callbackUrl tells NextAuth where to send the user after Google
  // completes. Because it's the same origin, NextAuth accepts it.
  const callbackUrl = `${baseUrl}/api/auth/mobile-callback`;

  // Build the NextAuth Google signin URL directly — this skips the
  // custom signIn page (/login) and goes straight to Google's OAuth screen.
  const googleSignInUrl = `${baseUrl}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const response = NextResponse.redirect(googleSignInUrl);

  // Set a short-lived cookie so mobile-callback knows this is a mobile
  // OAuth flow and should mint a JWT + redirect to the deep link.
  response.cookies.set("sp_mobile_auth", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes — plenty for OAuth round-trip
    path: "/",
  });

  return response;
}
