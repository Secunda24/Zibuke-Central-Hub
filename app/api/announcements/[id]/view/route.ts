import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { audienceSqlForUser, getCurrentDbUser } from "@/src/modules/announcements/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;

  try {
    const user = await getCurrentDbUser(db, session.userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.role !== "admin") {
      const audience = audienceSqlForUser(user);
      const visible = await db.prepare(`
        SELECT a.id FROM announcements a
        WHERE a.id = ? AND a.status IN ('published','archived') AND ${audience.clause}
      `).bind(id, ...audience.binds).first<Pick<DatabaseRows["announcements"], "id">>();
      if (!visible) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    } else {
      const exists = await db.prepare("SELECT id FROM announcements WHERE id = ?").bind(id).first<Pick<DatabaseRows["announcements"], "id">>();
      if (!exists) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.prepare(`
      INSERT INTO announcement_views (announcement_id, user_id, first_viewed_at, last_viewed_at, view_count)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
      ON CONFLICT(announcement_id, user_id)
      DO UPDATE SET last_viewed_at = CURRENT_TIMESTAMP, view_count = announcement_views.view_count + 1
    `).bind(id, session.userId).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcement view tracking error", error);
    return NextResponse.json({ error: "Could not record announcement view" }, { status: 500 });
  }
}
