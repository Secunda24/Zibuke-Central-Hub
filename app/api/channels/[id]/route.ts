import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession(req.cookies);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const channelId = (await params).id;

    const currentUser = (await db.prepare("SELECT role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "role">>()) as { role: string } | null;
    const channel = (await db.prepare("SELECT created_by FROM channels WHERE id = ?").bind(channelId).first<Pick<DatabaseRows["channels"], "created_by">>()) as { created_by: string } | null;

    if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

    const isAdmin = currentUser?.role?.toLowerCase() === "admin";
    const isCreator = channel.created_by === session.userId;

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: "Forbidden: You lack permission." }, { status: 403 });
    }

    // Archive the channel without destroying conversations, meetings or audit history.
    await db.prepare("UPDATE channels SET archived_at=COALESCE(archived_at,CURRENT_TIMESTAMP) WHERE id=?").bind(channelId).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete channel:", error);
    return NextResponse.json({ error: "Internal server error during deletion." }, { status: 500 });
  }
}
