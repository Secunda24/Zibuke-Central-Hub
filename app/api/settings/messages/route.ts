import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.userId;

  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get('otherUserId');

  if (!otherUserId) return NextResponse.json({ error: "Missing user ID" }, { status: 400 });

  try {
    const { results } = await db.prepare(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `).bind(currentUserId, otherUserId, otherUserId, currentUserId).all<Pick<DatabaseRows["messages"], "id" | "sender_id" | "receiver_id" | "content" | "created_at" | "reply_to_id" | "edited_at" | "deleted_at">>();

    return NextResponse.json({ messages: results });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.userId;

  try {
    const body = await request.json();
    const { receiverId, content } = body;
    const messageId = crypto.randomUUID();

    await db.prepare('INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)')
      .bind(messageId, currentUserId, receiverId, content)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}