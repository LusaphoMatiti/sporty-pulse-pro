import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL!;

  const redirectUri =
    req.nextUrl.searchParams.get("redirectUri") ?? "sporty-pulse-pro://auth";

  // Encode redirectUri into the callbackUrl so mobile-callback receives it
  // after the OAuth round-trip completes.
  const callbackUrl = `${baseUrl}/api/auth/mobile-callback?redirectUri=${encodeURIComponent(redirectUri)}`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Connecting to Google…</title>
    <style>
      :root {
        color-scheme: dark;
      }
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        background: #0C0E10;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .screen {
        height: 100vh;
        width: 100vw;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        background: #0C0E10;
      }
      .logo {
        width: 60px;
        height: 60px;
        border-radius: 14px;
        object-fit: contain;
      }
      .spinner {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid rgba(200, 241, 53, 0.15);
        border-top-color: #C8F135;
        animation: spin 0.8s linear infinite;
      }
      .label {
        color: #9A9A90;
        font-size: 14px;
        letter-spacing: 0.2px;
      }
      .label strong {
        color: #F0EDE4;
        font-weight: 600;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      noscript .label {
        color: #FF4D4D;
      }
    </style>
  </head>
  <body>
    <div class="screen">
      <div class="spinner" role="status" aria-label="Connecting"></div>
      <p class="label">Connecting to <strong>Google</strong>…</p>
    </div>

    <form id="f" method="POST" action="${baseUrl}/api/auth/signin/google" style="display:none;">
      <input type="hidden" name="callbackUrl" value="${callbackUrl}" />
      <input type="hidden" name="csrfToken" id="csrf" />
    </form>

    <noscript>
      <div class="screen">
        <p class="label">JavaScript is required to continue. Please try again.</p>
      </div>
    </noscript>

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
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
