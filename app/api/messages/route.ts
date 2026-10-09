import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";
import { createNotification } from "@/src/modules/backend/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingAttachment = {
  id?: string;
  type?: string;
  name?: string;
  sizeBytes?: number;
  mimeType?: string;
  storageKey?: string;
  url?: string;
};

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentUserId = session.userId;

  const { searchParams } = new URL(request.url);
  const chatWithId = searchParams.get("chatWith");

  try {
    if (!chatWithId) {
      const { results } = await db.prepare(`
        SELECT u.id,
               COALESCE(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), u.email) AS name,
               u.first_name, u.last_name, u.department,
               (SELECT COUNT(*)
                  FROM messages m
                 WHERE m.sender_id = u.id
                   AND m.receiver_id = ?
                   AND datetime(m.created_at) > datetime(COALESCE((
                     SELECT dr.last_read_at FROM direct_read_state dr
                     WHERE dr.user_id = ? AND dr.peer_id = u.id
                   ), '1970-01-01'))
               ) AS unread_count,
               (SELECT MAX(m2.created_at) FROM messages m2
                 WHERE (m2.sender_id = ? AND m2.receiver_id = u.id)
                    OR (m2.sender_id = u.id AND m2.receiver_id = ?)) AS last_activity
        FROM users u
        WHERE u.id != ? AND u.archived_at IS NULL
        ORDER BY CASE WHEN last_activity IS NULL THEN 1 ELSE 0 END, last_activity DESC, name COLLATE NOCASE ASC
      `).bind(currentUserId, currentUserId, currentUserId, currentUserId, currentUserId).all<Pick<DatabaseRows["users"], "id" | "first_name" | "last_name" | "department"> & {"name":string;"unread_count":number;"last_activity":string}>();
      return NextResponse.json({ users: results });
    }

    const query = await db.prepare(`
      SELECT messages.*,
             COALESCE(TRIM(COALESCE(sender.first_name, '') || ' ' || COALESCE(sender.last_name, '')), sender.email) AS sender_name,
             parent.content AS reply_content,
             parent.deleted_at AS reply_deleted_at,
             COALESCE(TRIM(COALESCE(parent_sender.first_name, '') || ' ' || COALESCE(parent_sender.last_name, '')), parent_sender.email) AS reply_sender_name
      FROM messages
      JOIN users sender ON sender.id = messages.sender_id
      LEFT JOIN messages parent ON parent.id = messages.reply_to_id
      LEFT JOIN users parent_sender ON parent_sender.id = parent.sender_id
      WHERE (messages.sender_id = ? AND messages.receiver_id = ?)
         OR (messages.sender_id = ? AND messages.receiver_id = ?)
      ORDER BY messages.created_at ASC
    `).bind(currentUserId, chatWithId, chatWithId, currentUserId).all<Pick<DatabaseRows["messages"], "id" | "sender_id" | "receiver_id" | "content" | "created_at" | "reply_to_id" | "edited_at" | "deleted_at"> & {"sender_name":string;"reply_content":string;"reply_deleted_at":string;"reply_sender_name":string}>();

    const messages = query.results;
    const { results: attachmentRows } = await db.prepare(`
      SELECT a.*
      FROM message_attachments a
      WHERE a.target_type = 'direct'
        AND a.target_id IN (
          SELECT id FROM messages
          WHERE (sender_id = ? AND receiver_id = ?)
             OR (sender_id = ? AND receiver_id = ?)
        )
      ORDER BY a.created_at ASC
    `).bind(currentUserId, chatWithId, chatWithId, currentUserId).all<Pick<DatabaseRows["message_attachments"], "id" | "target_type" | "target_id" | "uploaded_by" | "kind" | "filename" | "mime_type" | "size_bytes" | "storage_key" | "external_url" | "created_at">>();

    const { results: reactionRows } = await db.prepare(`
      SELECT r.target_id, r.emoji, r.user_id
      FROM message_reactions r
      WHERE r.target_type = 'direct'
        AND r.target_id IN (
          SELECT id FROM messages
          WHERE (sender_id = ? AND receiver_id = ?)
             OR (sender_id = ? AND receiver_id = ?)
        )
    `).bind(currentUserId, chatWithId, chatWithId, currentUserId).all<Pick<DatabaseRows["message_reactions"], "target_id" | "emoji" | "user_id">>();

    await db.prepare(`
      INSERT INTO direct_read_state (user_id, peer_id, last_read_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, peer_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `).bind(currentUserId, chatWithId).run();

    return NextResponse.json({ messages: decorateMessages(messages, attachmentRows, reactionRows, currentUserId) });
  } catch (error) {
    console.error("Messages GET error", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const senderId = session.userId;

  try {
    const { receiverId, content, replyToId, attachments = [] } = await request.json() as { receiverId: string; content?: string; replyToId?: string | null; attachments?: IncomingAttachment[] };
    const cleanContent = typeof content === "string" ? content.trim() : "";

    if (!receiverId || (!cleanContent && !attachments.length)) {
      return NextResponse.json({ error: "Receiver and message content are required" }, { status: 400 });
    }
    if (receiverId === senderId) return NextResponse.json({ error: "You cannot send a direct message to yourself" }, { status: 400 });

    const receiver = await db.prepare("SELECT id FROM users WHERE id = ?").bind(receiverId).first<Pick<DatabaseRows["users"], "id">>();
    if (!receiver) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

    let validReplyId: string | null = null;
    if (replyToId) {
      const parent = await db.prepare(`
        SELECT id FROM messages
        WHERE id = ?
          AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
      `).bind(replyToId, senderId, receiverId, receiverId, senderId).first<Pick<DatabaseRows["messages"], "id">>();
      if (parent) validReplyId = replyToId;
    }

    const messageId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO messages (id, sender_id, receiver_id, content, reply_to_id) VALUES (?, ?, ?, ?, ?)"
    ).bind(messageId, senderId, receiverId, cleanContent, validReplyId).run();

    await persistAttachments(db, attachments, "direct", messageId, senderId);
    await createNotification(db, {
      id: `direct-message:${messageId}:${receiverId}`,
      userId: receiverId,
      content: cleanContent ? `New direct message: ${cleanContent.slice(0, 90)}` : "New direct message with an attachment",
      kind: "direct_message",
      entityType: "direct_message",
      entityId: messageId,
      actorId: senderId,
      metadata: { senderId },
    });
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    console.error("Messages POST error", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

async function persistAttachments(db: D1Database, attachments: IncomingAttachment[], targetType: "direct" | "channel", targetId: string, userId: string) {
  for (const item of attachments.slice(0, 8)) {
    const kind = ["document", "image", "video", "audio", "link"].includes(item.type || "") ? item.type : "document";
    const externalUrl = kind === "link" ? cleanExternalUrl(item.url) : null;
    const storageKey = item.storageKey && item.storageKey.startsWith(`collaboration/${userId}/`) ? item.storageKey : null;
    if (!externalUrl && !storageKey) continue;

    await db.prepare(`
      INSERT INTO message_attachments
        (id, target_type, target_id, uploaded_by, kind, filename, mime_type, size_bytes, storage_key, external_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id || crypto.randomUUID(), targetType, targetId, userId, kind,
      String(item.name || "Attachment").slice(0, 240), item.mimeType || null,
      Number(item.sizeBytes || 0), storageKey, externalUrl
    ).run();
  }
}

function cleanExternalUrl(value?: string) {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value.slice(0, 2000);
}

function decorateMessages(messages: {id:string}[], attachments: DatabaseRows["message_attachments"][], reactions: Pick<DatabaseRows["message_reactions"],"user_id"|"emoji"|"target_id">[], currentUserId: string) {
  const attachmentsByMessage = new Map<string, {id:string;kind:string;filename:string;mime_type:string|null;size_bytes:number|null;url:string}[]>();
  for (const item of attachments) {
    const list = attachmentsByMessage.get(item.target_id) || [];
    list.push({
      id: item.id,
      kind: item.kind,
      filename: item.filename,
      mime_type: item.mime_type,
      size_bytes: item.size_bytes,
      url: item.external_url || `/api/attachments/${item.id}`,
    });
    attachmentsByMessage.set(item.target_id, list);
  }

  const reactionsByMessage = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const row of reactions) {
    const byEmoji = reactionsByMessage.get(row.target_id) || new Map();
    const current = byEmoji.get(row.emoji) || { count: 0, reactedByMe: false };
    current.count += 1;
    if (row.user_id === currentUserId) current.reactedByMe = true;
    byEmoji.set(row.emoji, current);
    reactionsByMessage.set(row.target_id, byEmoji);
  }

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) || [],
    reactions: Array.from(reactionsByMessage.get(message.id)?.entries() || []).map(([emoji, value]) => ({ emoji, ...value })),
  }));
}