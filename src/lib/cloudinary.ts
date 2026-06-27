import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export default cloudinary;

type Preset = "hero" | "card" | "miniCard" | "thumb" | "squareThumb";

const PRESETS: Record<Preset, string> = {
  hero: "w_1600,h_900,c_fit,b_rgb:0C0E10,f_auto,q_auto,dpr_auto",
  card: "w_800,h_1120,c_fit,b_rgb:0C0E10,f_auto,q_auto,dpr_auto",
  miniCard: "w_600,h_400,c_fit,b_rgb:0C0E10,f_auto,q_auto,dpr_auto",
  thumb: "w_400,h_300,c_fit,b_rgb:0C0E10,f_auto,q_auto,dpr_auto",
  squareThumb: "w_400,h_400,c_fit,b_rgb:0C0E10,f_auto,q_auto,dpr_auto",
};

// ── Core builder ──────────────────────────────────────────────────────────────
function cloudinaryBase() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) throw new Error("CLOUDINARY_CLOUD_NAME env var is not set");
  return `https://res.cloudinary.com/${cloud}/image/upload`;
}

export function buildCloudinaryUrl(
  imageUrl: string | null | undefined,
  preset: Preset,
): string | null {
  if (!imageUrl) return null;

  const transformation = PRESETS[preset];
  const publicId = extractPublicId(imageUrl);
  if (!publicId) return null;

  return `${cloudinaryBase()}/${transformation}/${publicId}`;
}

// ── Public-ID extractor ───────────────────────────────────────────────────────

function extractPublicId(imageUrl: string): string | null {
  if (!imageUrl) return null;

  if (imageUrl.includes("res.cloudinary.com")) {
    const uploadIndex = imageUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    const afterUpload = imageUrl.slice(uploadIndex + "/upload/".length);
    const parts = afterUpload.split("/");
    const firstNonTransform = parts.findIndex(
      (p) => !p.includes("_") || p.includes("."),
    );
    const publicIdParts =
      firstNonTransform >= 0 ? parts.slice(firstNonTransform) : parts;
    return publicIdParts.join("/");
  }

  if (imageUrl.startsWith("/v")) return imageUrl.slice(1);

  return imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
}

// ── Plan image resolver ───────────────────────────────────────────────────────

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

// ── Signed upload signature generator ────────────────────────────────────────
// Used by /api/upload/sign — never called client-side.
// The mobile app requests a short-lived signature, then uploads directly
// to Cloudinary. Your API secret never leaves the server.

export function generateUploadSignature(params: {
  folder: string;
  public_id?: string;
  timestamp: number;
}): string {
  return cloudinary.utils.api_sign_request(
    { ...params },
    process.env.CLOUDINARY_API_SECRET!,
  );
}
