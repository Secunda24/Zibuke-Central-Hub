import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifySession } from "@/src/modules/auth/session";
import {accessibleMessage} from '@/src/modules/backend/access';

export const runtime = "nodejs";

const ALLOWED = new Set(["👍", "❤️", "😂", "🎉", "✅", "👀"]);

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  try {
    const { targetType, targetId, emoji } = await request.json();
    if (!(["direct", "channel"] as string[]).includes(targetType) || !targetId || !ALLOWED.has(emoji)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    let target: {id:string}|null;
    if (targetType === "direct") {
      target = await db.prepare("SELECT id FROM messages WHERE id = ? AND deleted_at IS NULL AND (sender_id = ? OR receiver_id = ?)").bind(targetId, session.userId, session.userId).first<Pick<DatabaseRows["messages"], "id">>();
    } else {
      target = await accessibleMessage(db,'channel',targetId,session.userId);
    }
    if (!target) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const existing = await db.prepare(
      "SELECT id FROM message_reactions WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji = ?"
    ).bind(targetType, targetId, session.userId, emoji).first<Pick<DatabaseRows["message_reactions"], "id">>();

    if (existing) {
      await db.prepare("DELETE FROM message_reactions WHERE id = ?").bind(existing.id).run();
      return NextResponse.json({ success: true, active: false });
    }

    await db.prepare(
      "INSERT INTO message_reactions (id, target_type, target_id, user_id, emoji) VALUES (?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), targetType, targetId, session.userId, emoji).run();
    return NextResponse.json({ success: true, active: true });
  } catch (error) {
    console.error("Reaction error", error);
    return NextResponse.json({ error: "Could not update reaction" }, { status: 500 });
  }
}
