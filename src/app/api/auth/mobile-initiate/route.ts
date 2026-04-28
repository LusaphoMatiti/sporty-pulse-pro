// src/app/api/auth/mobile-initiate/route.ts
//
// Called by the Expo app to start Google OAuth without touching the web login page.
// NextAuth's /api/auth/signin/google only skips the custom signIn page when
// called as a POST — a GET always bounces through pages.signIn first.
//
// This route returns an HTML page that fetches the CSRF token then
// auto-submits a POST directly to NextAuth's Google provider endpoint,
// going straight to Google without ever hitting /login.

import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL!;
  const callbackUrl = `${baseUrl}/api/auth/mobile-callback`;
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
          document.cookie = 'sp_mobile_auth=1; path=/; max-age=600; samesite=lax${secure}';
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
