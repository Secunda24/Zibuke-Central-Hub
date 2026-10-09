import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fixed: Combine first_name and last_name instead of the old 'name' column
    const { results } = await db.prepare(`
      SELECT channels.*, (users.first_name || ' ' || users.last_name) as creator_name 
      FROM channels 
      JOIN users ON channels.created_by = users.id 
      WHERE channels.archived_at IS NULL AND (COALESCE(channels.visibility,'company')='company' OR channels.created_by=? OR EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id=channels.id AND m.user_id=?))
      ORDER BY channels.created_at DESC
    `).bind(session.userId,session.userId).all<Pick<DatabaseRows["channels"], "id" | "name" | "description" | "created_by" | "created_at" | "visibility" | "archived_at"> & {"creator_name":string}>();

    return NextResponse.json({ channels: results });
  } catch (error) {
    console.error("Failed to fetch channels:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  try {
    const { name, description } = await request.json();
    
    if (typeof name!=='string'||!name.trim()||name.length>100|| (description!==undefined&&(typeof description!=='string'||description.length>2000))) {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
    }

    const channelId = crypto.randomUUID();
    // Format the channel name to be lowercase with dashes (e.g., "general-chat")
    const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-');

    await db.batch([db.prepare(
      'INSERT INTO channels (id, name, description, created_by) VALUES (?, ?, ?, ?)'
    ).bind(channelId, formattedName, description || "", userId),db.prepare("INSERT INTO channel_members(channel_id,user_id,member_role) VALUES(?,?,'owner')").bind(channelId,userId)]);

    return NextResponse.json({ success: true, channelId });
  } catch (error) {
    // A common error here is a UNIQUE constraint failure if the channel name already exists
    console.error("Failed to create channel:", error);
    return NextResponse.json({ error: "Failed to create channel. Name might already exist." }, { status: 500 });
  }
}
