import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

import { verifySession } from "@/src/modules/auth/session";
import {downloadHeaders} from '@/src/modules/backend/access';
import { audienceSqlForUser, getCurrentDbUser } from "@/src/modules/announcements/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const bucket = env.COLLAB_BUCKET;
  if (!bucket) return NextResponse.json({ error: "Attachment storage unavailable" }, { status: 500 });

  const user = await getCurrentDbUser(db, session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const attachment = await db.prepare(`
    SELECT aa.id, aa.filename, aa.mime_type, aa.storage_key,
           a.status, a.audience_type, a.audience_value
    FROM announcement_attachments aa
    JOIN announcements a ON a.id = aa.announcement_id
    WHERE aa.id = ?
  `).bind(id).first<Pick<DatabaseRows["announcement_attachments"], "id" | "filename" | "mime_type" | "storage_key"> & Pick<DatabaseRows["announcements"], "status" | "audience_type" | "audience_value">>();
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  if (user.role !== "admin") {
    const audience = audienceSqlForUser(user);
    const allowed = await db.prepare(`
      SELECT a.id FROM announcement_attachments aa
      JOIN announcements a ON a.id = aa.announcement_id
      WHERE aa.id = ? AND a.status IN ('published','archived') AND ${audience.clause}
    `).bind(id, ...audience.binds).first<Pick<DatabaseRows["announcements"], "id">>();
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const object = await bucket.get(attachment.storage_key);
  if (!object) return NextResponse.json({ error: "Attachment not found in storage" }, { status: 404 });
  const headers=downloadHeaders(attachment.filename||'attachment',attachment.mime_type||'application/octet-stream');
  return new Response(object.body as unknown as BodyInit, { headers });
}
