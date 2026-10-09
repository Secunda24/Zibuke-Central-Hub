import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";
import { audienceSqlForUser, getCurrentDbUser } from "@/src/modules/announcements/server";

export const runtime = "nodejs";
const ALLOWED = new Set(["👍", "❤️", "👏", "🎉"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { emoji } = await request.json();
  if (!ALLOWED.has(emoji)) return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const user = await getCurrentDbUser(db, session.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let announcement: Pick<DatabaseRows["announcements"],"id"|"reactions_enabled">|null;
  if (user.role === "admin") {
    announcement = await db.prepare("SELECT id, reactions_enabled FROM announcements WHERE id = ?").bind(id).first<Pick<DatabaseRows["announcements"], "id" | "reactions_enabled">>();
  } else {
    const audience = audienceSqlForUser(user);
    announcement = await db.prepare(`SELECT a.id, a.reactions_enabled FROM announcements a WHERE a.id = ? AND a.status IN ('published','archived') AND ${audience.clause}`)
      .bind(id, ...audience.binds).first<Pick<DatabaseRows["announcements"], "id" | "reactions_enabled">>();
  }
  if (!announcement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  if (!announcement.reactions_enabled) return NextResponse.json({ error: "Reactions are disabled for this announcement" }, { status: 403 });

  const existing = await db.prepare("SELECT id FROM announcement_reactions WHERE announcement_id = ? AND user_id = ? AND emoji = ?")
    .bind(id, session.userId, emoji).first<Pick<DatabaseRows["announcement_reactions"], "id">>();
  if (existing) {
    await db.prepare("DELETE FROM announcement_reactions WHERE id = ?").bind(existing.id).run();
    return NextResponse.json({ success: true, active: false });
  }

  await db.prepare("INSERT INTO announcement_reactions (id, announcement_id, user_id, emoji) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), id, session.userId, emoji).run();
  return NextResponse.json({ success: true, active: true });
}
