import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";
import { verifySession } from "@/src/modules/auth/session";
import {accessibleChannel} from '@/src/modules/backend/access';

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession(request.cookies);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const channelId = (await params).id;

    const channel = await accessibleChannel(db,channelId,session.userId);
    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    const { results: messages } = await db.prepare(`
      SELECT cm.id, cm.sender_id, cm.content, cm.created_at, cm.edited_at, (cm.deleted_at IS NOT NULL) AS is_deleted, cm.reply_to_id,
             (u.first_name || ' ' || u.last_name) as sender_name
      FROM channel_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.channel_id = ?
      ORDER BY cm.created_at ASC
    `).bind(channelId).all<Pick<DatabaseRows["channel_messages"], "id" | "sender_id" | "content" | "created_at" | "edited_at" | "reply_to_id"> & {"is_deleted":number;"sender_name":string}>();

    return NextResponse.json({ channel, messages });
  } catch (error) {
    console.error("Error fetching channel messages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession(request.cookies);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const channelId = (await params).id;
    if(!await accessibleChannel(db,channelId,session.userId)) return NextResponse.json({error:'Channel not found'},{status:404});
    
    const body = await request.json();
    const { content, replyToId } = body;

    if (typeof content!=='string'||!content.trim()||content.length>10000) return NextResponse.json({ error: "Message required (maximum 10,000 characters)" }, { status: 400 });
    if(replyToId&&!await db.prepare('SELECT id FROM channel_messages WHERE id=? AND channel_id=? AND deleted_at IS NULL').bind(replyToId,channelId).first<Pick<DatabaseRows["channel_messages"], "id">>()) return NextResponse.json({error:'Reply target is unavailable'},{status:400});

    const messageId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO channel_messages (id, channel_id, sender_id, content, reply_to_id)
      VALUES (?, ?, ?, ?, ?)
    `).bind(messageId, channelId, session.userId, content, replyToId || null).run();

    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
