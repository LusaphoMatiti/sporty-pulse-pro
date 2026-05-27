import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export default cloudinary;

/**
 * cloudinary.ts
 *
 * Central utility for building optimised Cloudinary delivery URLs.
 *
 * Every image that leaves the server goes through `buildCloudinaryUrl()`.
 * Callers pick a named preset that matches the UI surface — this ensures
 * every context gets the right dimensions, crop, format, and quality
 * without any guesswork on the client.
 *
 * PRESETS
 * ───────
 *  hero        → program hero card (full-width banner)   800 × 450 px
 *  card        → program list card (left-side image)     400 × 560 px
 *  miniCard    → horizontal scroll mini card             300 × 200 px
 *  thumb       → exercise row thumbnail                  200 × 150 px
 *  squareThumb → library / exercise grid tile            200 × 200 px
 *
 * All presets use:
 *  c_fill   → smart crop (keeps subject centred)
 *  f_auto   → serve WebP / AVIF automatically based on the device's Accept header
 *  q_auto   → Cloudinary picks the best quality / file-size tradeoff
 *
 * HOW TO USE
 * ──────────
 *  import { buildCloudinaryUrl } from "@/lib/cloudinary";
 *
 *  // In a route handler:
 *  const url = buildCloudinaryUrl(plan.imageUrl, "hero");
 *
 *  // Fallback chain (own image → first exercise thumbnail):
 *  const url = buildCloudinaryUrl(plan.imageUrl, "hero")
 *           ?? buildCloudinaryUrl(firstExerciseThumb, "hero");
 */

const CLOUDINARY_BASE = "https://res.cloudinary.com/dsoxsrjn2/image/upload";

// ─── Preset definitions ───────────────────────────────────────────────────────

type Preset = "hero" | "card" | "miniCard" | "thumb" | "squareThumb";

const PRESETS: Record<Preset, string> = {
  // Full-width program hero banner — fit whole subject, pad dark
  hero: "w_800,h_450,c_fit,b_rgb:0C0E10,f_auto,q_auto",

  // Plan list card left-side image — fit full body, pad dark
  card: "w_400,h_560,c_fit,b_rgb:0C0E10,f_auto,q_auto",

  // Horizontal scroll mini-card thumbnail
  miniCard: "w_300,h_200,c_fit,b_rgb:0C0E10,f_auto,q_auto",

  // Exercise row thumbnail (landscape)
  thumb: "w_200,h_150,c_fit,b_rgb:0C0E10,f_auto,q_auto",

  // Square tile (library grid, exercise cards)
  squareThumb: "w_200,h_200,c_fit,b_rgb:0C0E10,f_auto,q_auto",
};

// ─── Core builder ─────────────────────────────────────────────────────────────

/**
 * Accepts any image reference stored in the database and returns a fully-formed,
 * optimised Cloudinary delivery URL for the requested preset.
 *
 * Handles all four storage formats we have in the DB:
 *  1. Already-absolute URL (http/https)              → extract public ID, rebuild
 *  2. Cloudinary fragment starting with /v…          → strip leading /, rebuild
 *  3. Bare Cloudinary public ID (no leading slash)   → use directly
 *  4. Leading-slash relative path                    → treated as bare public ID
 *
 * Returns null when imageUrl is null / empty so callers can chain fallbacks with ??.
 */
export function buildCloudinaryUrl(
  imageUrl: string | null | undefined,
  preset: Preset,
): string | null {
  if (!imageUrl) return null;

  const transformation = PRESETS[preset];
  const publicId = extractPublicId(imageUrl);

  if (!publicId) return null;

  return `${CLOUDINARY_BASE}/${transformation}/${publicId}`;
}

// ─── Public-ID extractor ──────────────────────────────────────────────────────

function extractPublicId(imageUrl: string): string | null {
  if (!imageUrl) return null;

  // 1. Absolute Cloudinary URL — extract everything after /upload/ (strip any
  //    existing transformation segments that start with a letter+underscore pattern).
  if (imageUrl.includes("res.cloudinary.com")) {
    const uploadIndex = imageUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    const afterUpload = imageUrl.slice(uploadIndex + "/upload/".length);

    // Strip any existing transformation segment: a sequence of comma/letter/digit
    // segments before the first slash that contains a folder name.
    // Transformation segments look like "w_400,h_300,c_fill" — they always
    // contain underscores. Public IDs (folder/name) never do (usually).
    const parts = afterUpload.split("/");
    const firstNonTransform = parts.findIndex(
      (p) => !p.includes("_") || p.includes("."),
    );
    const publicIdParts =
      firstNonTransform >= 0 ? parts.slice(firstNonTransform) : parts;

    return publicIdParts.join("/");
  }

  // 2. /v<version>/folder/name  →  strip the leading slash
  if (imageUrl.startsWith("/v")) {
    return imageUrl.slice(1); // "v1234/sporty-pulse/exercises/pushup"
  }

  // 3. Bare public ID or leading-slash relative path — use as-is (strip leading /)
  return imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
}

// ─── Convenience: resolve best image for a plan ───────────────────────────────

/**
 * Resolves the best available image for a plan, trying the plan's own imageUrl
 * first and falling back to the first exercise's thumbnail.
 *
 * Usage:
 *   const url = resolvePlanImage(plan, "hero");
 */
export function resolvePlanImage(
  plan: {
    imageUrl: string | null;
    plannedSessions: {
      plannedExercises: { exercise: { thumbnailUrl: string | null } }[];
    }[];
  },
  preset: Preset,
): string | null {
  return (
    buildCloudinaryUrl(plan.imageUrl, preset) ??
    buildCloudinaryUrl(
      plan.plannedSessions[0]?.plannedExercises[0]?.exercise?.thumbnailUrl ??
        null,
      preset,
    )
  );
}
