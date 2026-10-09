import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  if (!room || room.length > 256) {
    return NextResponse.json({ error: "A valid room is required" }, { status: 400 });
  }
  try {
    const session = await verifySession(req.cookies);
    if (!session) return NextResponse.json({ error: "Please sign in again to join the call." }, { status: 401 });

    const { env } = await getCloudflareContext({ async: true });
    const config = env as unknown as Record<string, string | undefined>;
    const apiKey = config.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY;
    const apiSecret = config.LIVEKIT_API_SECRET || process.env.LIVEKIT_API_SECRET;
    const serverUrl = config.LIVEKIT_URL || config.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!apiKey || !apiSecret || !serverUrl) {
      return NextResponse.json({ error: "Calling is not configured. Please contact your administrator." }, { status: 503 });
    }
    if (new URL(serverUrl).protocol !== "wss:") {
      return NextResponse.json({ error: "The calling server URL must use wss://." }, { status: 503 });
    }
    const user = await env.DB.prepare("SELECT first_name, last_name FROM users WHERE id = ?")
      .bind(session.userId).first<Pick<DatabaseRows["users"], "first_name" | "last_name">>() as { first_name: string; last_name: string | null } | null;
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 401 });
    if(room!=='Zibuke-Company-Watercooler') {
      const invited=await env.DB.prepare(`SELECT id FROM call_signals WHERE room_name=? AND created_at>datetime('now','-2 hours') AND ((caller_id=? AND status IN ('ringing','answered')) OR (target_user_id=? AND status='answered'))`).bind(room,session.userId,session.userId).first<Pick<DatabaseRows["call_signals"], "id">>();
      const meeting=await env.DB.prepare(`SELECT e.id FROM events e LEFT JOIN channels c ON c.id=e.channel_id WHERE e.meeting_room=? AND e.cancelled_at IS NULL AND datetime(e.end_time)>datetime('now') AND (e.organizer_id=? OR EXISTS(SELECT 1 FROM event_attendees a WHERE a.event_id=e.id AND a.user_id=? AND a.response<>'declined') OR (c.archived_at IS NULL AND (c.visibility='company' OR c.created_by=? OR EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id=c.id AND m.user_id=?))))`).bind(room,session.userId,session.userId,session.userId,session.userId).first<Pick<DatabaseRows["events"], "id">>();
      if(!invited&&!meeting)return NextResponse.json({error:'You do not have access to this call'},{status:403});
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: session.userId,
      name: [user.first_name, user.last_name].filter(Boolean).join(" "),
      ttl: "1h",
    });
    token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    return NextResponse.json({ token: await token.toJwt(), serverUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to prepare the call. Please retry or contact your administrator." }, { status: 500 });
  }
}
