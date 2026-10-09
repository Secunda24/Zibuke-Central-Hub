import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const session = await verifySession(request.cookies);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // FIX: Use SELECT * to avoid asking for columns that don't exist in the table
    const newDm = await db.prepare(`
      SELECT * 
      FROM messages 
      WHERE receiver_id = ? 
      AND deleted_at IS NULL
      AND datetime(created_at)>datetime(COALESCE((SELECT last_read_at FROM direct_read_state WHERE user_id=messages.receiver_id AND peer_id=messages.sender_id),'1970-01-01'))
      ORDER BY created_at DESC LIMIT 1
    `).bind(session.userId).first<Pick<DatabaseRows["messages"], "id" | "sender_id" | "receiver_id" | "content" | "created_at" | "reply_to_id" | "edited_at" | "deleted_at">>();

    if (newDm) {
      return NextResponse.json({
        notification: {
          id: newDm.id,
          type: "message",
          title: "New Direct Message",
          message: newDm.content || "Sent an attachment",
          link: `/dashboard/messages/${encodeURIComponent(newDm.sender_id)}`
        }
      });
    }

    return NextResponse.json({ notification: null });
  } catch (error) {
    console.error("Backend crash:", error);
    // FIX: Send the exact error string back to the browser so we don't have to guess!
    return NextResponse.json(
      { error: "Could not load latest notifications" }, 
      { status: 500 }
    );
  }
}
