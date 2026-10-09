import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findOwnedMessage(db: D1Database, channelId: string, messageId: string, userId: string) {
  return db.prepare(`
    SELECT id, sender_id, message_type, (deleted_at IS NOT NULL) AS is_deleted
    FROM channel_messages
    WHERE id = ? AND channel_id = ?
  `).bind(messageId, channelId).first<Pick<DatabaseRows["channel_messages"], "id" | "sender_id" | "message_type"> & {"is_deleted":number}>().then((row) => {
    if (!row) return { error: "Message not found", status: 404 };
    if (row.sender_id !== userId) return { error: "You can only change messages you sent", status: 403 };
    if (row.message_type !== "message") return { error: "Meeting cards cannot be edited as messages", status: 400 };
    return { row };
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id, messageId } = await params;

  try {
    const owned = await findOwnedMessage(db, id, messageId, session.userId);
    if (!owned.row) return NextResponse.json({ error: owned.error }, { status: owned.status });
    if (owned.row.is_deleted === 1) return NextResponse.json({ error: "Deleted messages cannot be edited" }, { status: 400 });

    const body = await request.json();
    const content = String(body.content || "").trim().slice(0, 10000);
    if (!content) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

    await db.prepare(`
      UPDATE channel_messages
      SET content = ?, edited_at = CURRENT_TIMESTAMP
      WHERE id = ? AND channel_id = ? AND sender_id = ?
    `).bind(content, messageId, id, session.userId).run();

    return NextResponse.json({ success: true, messageId, content });
  } catch (error) {
    console.error("Channel message PATCH error", error);
    return NextResponse.json({ error: "Failed to edit message" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id, messageId } = await params;

  try {
    const owned = await findOwnedMessage(db, id, messageId, session.userId);
    if (!owned.row) return NextResponse.json({ error: owned.error }, { status: owned.status });
    if (owned.row.is_deleted === 1) return NextResponse.json({ success: true, messageId });

    await db.batch([
      db.prepare("DELETE FROM message_attachments WHERE target_type = 'channel' AND target_id = ?").bind(messageId),
      db.prepare("DELETE FROM message_reactions WHERE target_type = 'channel' AND target_id = ?").bind(messageId),
      db.prepare(`
        UPDATE channel_messages
        SET content = 'This message was deleted', deleted_at = CURRENT_TIMESTAMP
        WHERE id = ? AND channel_id = ? AND sender_id = ?
      `).bind(messageId, id, session.userId),
    ]);

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("Channel message DELETE error", error);
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
  }
}