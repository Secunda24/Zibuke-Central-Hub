import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

import { verifySession } from "@/src/modules/auth/session";
import { audienceSqlForUser, getCurrentDbUser } from "@/src/modules/announcements/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const user = await getCurrentDbUser(db, session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let announcement: Pick<DatabaseRows["announcements"],"id"|"require_acknowledgement">|null;
  if (user.role === "admin") {
    announcement = await db.prepare("SELECT id, require_acknowledgement FROM announcements WHERE id = ?").bind(id).first<Pick<DatabaseRows["announcements"], "id" | "require_acknowledgement">>();
  } else {
    const audience = audienceSqlForUser(user);
    announcement = await db.prepare(`SELECT a.id, a.require_acknowledgement FROM announcements a WHERE a.id = ? AND a.status IN ('published','archived') AND ${audience.clause}`)
      .bind(id, ...audience.binds).first<Pick<DatabaseRows["announcements"], "id" | "require_acknowledgement">>();
  }
  if (!announcement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  if (!announcement.require_acknowledgement) return NextResponse.json({ error: "Acknowledgement is not required" }, { status: 400 });

  await db.prepare(`
    INSERT INTO announcement_acknowledgements (announcement_id, user_id, acknowledged_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(announcement_id, user_id) DO UPDATE SET acknowledged_at = excluded.acknowledged_at
  `).bind(id, session.userId).run();
  return NextResponse.json({ success: true });
}
