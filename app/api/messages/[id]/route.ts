import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findOwnedDirectMessage(db: D1Database, messageId: string, userId: string) {
  const row = await db.prepare(
    "SELECT id, sender_id, receiver_id, deleted_at FROM messages WHERE id = ?"
  ).bind(messageId).first<Pick<DatabaseRows["messages"], "id" | "sender_id" | "receiver_id" | "deleted_at">>();
  if (!row) return { error: "Message not found", status: 404 };
  if (row.sender_id !== userId) return { error: "You can only change messages you sent", status: 403 };
  return { row };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;

  try {
    const owned = await findOwnedDirectMessage(db, id, session.userId);
    if (!owned.row) return NextResponse.json({ error: owned.error }, { status: owned.status });
    if (owned.row.deleted_at) return NextResponse.json({ error: "Deleted messages cannot be edited" }, { status: 400 });

    const body = await request.json();
    const content = String(body.content || "").trim().slice(0, 10000);
    if (!content) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

    await db.prepare(`
      UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP
      WHERE id = ? AND sender_id = ?
    `).bind(content, id, session.userId).run();

    return NextResponse.json({ success: true, messageId: id, content });
  } catch (error) {
    console.error("Direct message PATCH error", error);
    return NextResponse.json({ error: "Failed to edit message" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;

  try {
    const owned = await findOwnedDirectMessage(db, id, session.userId);
    if (!owned.row) return NextResponse.json({ error: owned.error }, { status: owned.status });
    if (owned.row.deleted_at) return NextResponse.json({ success: true, messageId: id });

    await db.batch([
      db.prepare("DELETE FROM message_attachments WHERE target_type = 'direct' AND target_id = ?").bind(id),
      db.prepare("DELETE FROM message_reactions WHERE target_type = 'direct' AND target_id = ?").bind(id),
      db.prepare(`
        UPDATE messages SET content = 'Message deleted', deleted_at = CURRENT_TIMESTAMP
        WHERE id = ? AND sender_id = ?
      `).bind(id, session.userId),
    ]);

    return NextResponse.json({ success: true, messageId: id });
  } catch (error) {
    console.error("Direct message DELETE error", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}
