import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { accessibleMessage, downloadHeaders } from '@/src/modules/backend/access';

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const bucket = env.COLLAB_BUCKET;
  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  const attachment = await db.prepare(
    "SELECT id, filename, mime_type, storage_key, external_url,target_type,target_id FROM message_attachments WHERE id = ?"
  ).bind(id).first<Pick<DatabaseRows["message_attachments"], "id" | "filename" | "mime_type" | "storage_key" | "external_url" | "target_type" | "target_id">>();

  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  if(!await accessibleMessage(db,attachment.target_type,attachment.target_id,session.userId)) return NextResponse.json({error:'Attachment not found'},{status:404});
  if (attachment.external_url) return NextResponse.redirect(attachment.external_url, 302);
  if (!bucket || !attachment.storage_key) return NextResponse.json({ error: "Attachment storage unavailable" }, { status: 404 });

  const object = await bucket.get(attachment.storage_key);
  if (!object) return NextResponse.json({ error: "Attachment not found in storage" }, { status: 404 });

  const headers = downloadHeaders(attachment.filename||'attachment',attachment.mime_type||'application/octet-stream');
  return new Response(object.body as unknown as BodyInit, { headers });
}
