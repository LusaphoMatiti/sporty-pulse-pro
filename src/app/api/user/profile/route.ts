import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log("[profile] userId from session:", userId);

    // Verify the user actually exists before attempting update
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    console.log("[profile] DB lookup result:", existing);

    const form = await req.formData();
    const name = form.get("name") as string | null;
    const photo = form.get("photo") as File | null;

    let imageUrl: string | undefined;
    if (photo && photo.size > 0) {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const dataUri = `data:${photo.type};base64,${buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "avatars",
        public_id: userId,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
        ],
      });
      imageUrl = result.secure_url;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
      },
      select: { id: true, name: true, email: true, image: true, role: true },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object"
          ? JSON.stringify(error)
          : String(error);
    console.error("[PATCH /api/user/profile] FULL ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
