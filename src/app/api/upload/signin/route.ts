// The mobile app calls this before every upload.
// It receives a signed timestamp + signature, then posts the file
// DIRECTLY to Cloudinary — your API secret never touches the client.
//
// Flow:
//   RN app → POST /api/upload/sign  → { signature, timestamp, apiKey, cloudName }
//   RN app → POST https://api.cloudinary.com/v1_1/<cloud>/image/upload (direct)

import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/getSession";
import { generateUploadSignature } from "@/lib/cloudinary";
import {
  apiSuccess,
  unauthorized,
  validationError,
  internalError,
} from "@/lib/api-response";

// Allowed folders — whitelist prevents the app from writing anywhere in your account
const ALLOWED_FOLDERS = ["avatars", "recovery"] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) return unauthorized();

    const body = await req.json().catch(() => null);
    const folder: AllowedFolder = body?.folder ?? "avatars";

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return validationError(
        `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(", ")}`,
      );
    }

    const timestamp = Math.round(Date.now() / 1000);

    // public_id scoped to the user so no one can overwrite someone else's file
    const public_id = `${folder}/${session.user.id}`;

    const signature = generateUploadSignature({ folder, public_id, timestamp });

    return apiSuccess({
      signature,
      timestamp,
      public_id,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY!,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    });
  } catch (err) {
    console.error("[upload/sign] error:", err);
    return internalError(err);
  }
}
