//
// Called by the Expo app to start Google OAuth without touching the web login page.
// Receives ?redirectUri=<app-deep-link> from the Expo app, encodes it into
// the callbackUrl so mobile-callback knows where to send the final deep link.

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL!;

  // The deep-link scheme the app is currently running under.
  // In dev: exp+sporty-pulse-expo://expo-development-client/...
  // In prod: sporty-pulse-pro://auth
  const redirectUri =
    req.nextUrl.searchParams.get("redirectUri") ?? "sporty-pulse-pro://auth";

  // Encode redirectUri into the callbackUrl so mobile-callback receives it
  // after the OAuth round-trip completes.
  const callbackUrl = `${baseUrl}/api/auth/mobile-callback?redirectUri=${encodeURIComponent(redirectUri)}`;

  const secure = process.env.NODE_ENV === "production" ? "; secure" : "";

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Connecting to Google…</title>
  </head>
  <body>
    <form id="f" method="POST" action="${baseUrl}/api/auth/signin/google">
      <input type="hidden" name="callbackUrl" value="${callbackUrl}" />
      <input type="hidden" name="csrfToken" id="csrf" />
    </form>
    <script>
      fetch('${baseUrl}/api/auth/csrf')
        .then(r => r.json())
        .then(data => {
          document.getElementById('csrf').value = data.csrfToken;
          document.getElementById('f').submit();
        })
        .catch(() => {
          window.location.href = '${baseUrl}/login';
        });
    </script>
    <p>Connecting to Google…</p>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
