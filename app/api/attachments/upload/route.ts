import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
]);

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.COLLAB_BUCKET;
  if (!bucket) return NextResponse.json({ error: "Collaboration storage binding missing" }, { status: 500 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File required" }, { status: 400 });
    if (file.size <= 0) return NextResponse.json({ error: "The selected file is empty" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Attachments are limited to 25 MB each" }, { status: 413 });

    const mime = file.type || "application/octet-stream";
    if (mime === "image/gif") return NextResponse.json({ error: "GIF files are not supported in Zibuke Central" }, { status: 415 });
    const allowed = ALLOWED_PREFIXES.some((prefix) => mime.startsWith(prefix)) || ALLOWED_TYPES.has(mime);
    if (!allowed) return NextResponse.json({ error: "This file type is not supported" }, { status: 415 });

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-120) || "attachment";
    const storageKey = `collaboration/${session.userId}/${id}-${safeName}`;
    const data = await file.arrayBuffer();

    await bucket.put(storageKey, data, {
      httpMetadata: { contentType: mime },
      customMetadata: { originalName: file.name, uploadedBy: session.userId },
    });

    const type = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "document";

    return NextResponse.json({
      attachment: {
        id,
        type,
        name: file.name,
        size: formatBytes(file.size),
        sizeBytes: file.size,
        mimeType: mime,
        storageKey,
      },
    });
  } catch (error) {
    console.error("Attachment upload error", error);
    return NextResponse.json({ error: "Attachment upload failed" }, { status: 500 });
  }
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
