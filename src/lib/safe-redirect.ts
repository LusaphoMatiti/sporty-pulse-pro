const ALLOWED_REDIRECT_PREFIXES = ["sporty-pulse-pro://"];

// The Expo dev client link is only accepted outside production.
if (process.env.NODE_ENV !== "production") {
  ALLOWED_REDIRECT_PREFIXES.push("exp+sporty-pulse-expo://");
}

const FALLBACK_REDIRECT = "sporty-pulse-pro://auth";

export function safeRedirectUri(value: string | null): string {
  if (!value) return FALLBACK_REDIRECT;

  const startsWithAllowedScheme = ALLOWED_REDIRECT_PREFIXES.some((prefix) =>
    value.startsWith(prefix),
  );
  // Blocks quotes, angle brackets, spaces and anything else that could
  // break out of the HTML/JS the callback page builds around this value.
  const hasOnlySafeCharacters = /^[A-Za-z0-9+\-._~:/]+$/.test(value);

  return startsWithAllowedScheme && hasOnlySafeCharacters
    ? value
    : FALLBACK_REDIRECT;
}
