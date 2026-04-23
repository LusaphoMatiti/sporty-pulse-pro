// middleware.ts
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/pricing", "/about", "/privacy", "/terms", "/outbound"];
const AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_ROUTES = [
  "/",
  "/training",
  "/workout",
  "/progress",
  "/settings",
  "/programs",
  "/coach",
  "/store",
];

function matchesRoute(pathname: string, routes: string[]) {
  return routes.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route),
  );
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Always public
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Auth pages
  if (matchesRoute(pathname, AUTH_ROUTES)) {
    if (!token) return NextResponse.next();
    if (token.isNewUser)
      return NextResponse.redirect(new URL("/welcome", req.url));
    if (!token.onboardingComplete)
      return NextResponse.redirect(new URL("/onboard", req.url));
    return NextResponse.redirect(new URL("/", req.url));
  }

  // /welcome
  if (
    pathname.startsWith("/welcome") &&
    !pathname.startsWith("/welcome-back")
  ) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (!token.isNewUser) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // /welcome-back
  if (pathname.startsWith("/welcome-back")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (token.isNewUser)
      return NextResponse.redirect(new URL("/welcome", req.url));
    if (!token.onboardingComplete)
      return NextResponse.redirect(new URL("/onboard", req.url));
    return NextResponse.next();
  }

  // /onboard — NEW USER ONBOARDING GATE
  // Authenticated users who haven't completed onboarding land here.
  // Once they POST to /api/onboarding/complete the token refreshes and
  // they'll be redirected to "/" on next request.
  if (pathname.startsWith("/onboard")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (token.onboardingComplete)
      return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // Protected app routes
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (token.isNewUser)
      return NextResponse.redirect(new URL("/welcome", req.url));
    // KEY GATE: un-onboarded users cannot reach any protected route
    if (!token.onboardingComplete)
      return NextResponse.redirect(new URL("/onboard", req.url));

    if (pathname === "/") {
      const seen = req.cookies.get("sp_welcomed")?.value;
      if (!seen) {
        const res = NextResponse.redirect(new URL("/welcome-back", req.url));
        res.cookies.set("sp_welcomed", "1", {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24,
          path: "/",
        });
        return res;
      }
    }

    return NextResponse.next();
  }

  // Catch-all
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
