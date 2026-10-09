import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const dynamic = "force-dynamic";


export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (typeof body.targetUserId !== "string" || !body.targetUserId || typeof body.roomName !== "string" || !body.roomName || body.roomName.length > 256) {
    return NextResponse.json({ error: "A recipient and room are required" }, { status: 400 });
  }
  const { env } = await getCloudflareContext({ async: true });
  const caller = await env.DB.prepare("SELECT first_name, last_name FROM users WHERE id = ?")
    .bind(session.userId).first<Pick<DatabaseRows["users"], "first_name" | "last_name">>() as { first_name: string; last_name: string | null } | null;
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if(body.targetUserId===session.userId||!await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(body.targetUserId).first<Pick<DatabaseRows["users"], "id">>())return NextResponse.json({error:'Choose another employee'},{status:400});
  const roomOwner=await env.DB.prepare('SELECT caller_id FROM call_signals WHERE room_name=? LIMIT 1').bind(body.roomName).first<Pick<DatabaseRows["call_signals"], "caller_id">>();
  const reserved=await env.DB.prepare('SELECT id FROM events WHERE meeting_room=?').bind(body.roomName).first<Pick<DatabaseRows["events"], "id">>();
  if(reserved||(roomOwner&&roomOwner.caller_id!==session.userId)||body.roomName==='Zibuke-Company-Watercooler')return NextResponse.json({error:'Choose a new direct call room'},{status:403});
  const id = crypto.randomUUID();
  const callerName = [caller.first_name, caller.last_name].filter(Boolean).join(" ");
  await env.DB.prepare(
    "INSERT INTO call_signals (id, caller_id, caller_name, target_user_id, room_name, status) VALUES (?, ?, ?, ?, ?, 'ringing')"
  ).bind(id, session.userId, callerName, body.targetUserId, body.roomName).run();
  return NextResponse.json({ success: true, signalId: id, roomName: body.roomName });
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    "SELECT * FROM call_signals WHERE target_user_id = ? AND status = 'ringing' AND created_at > datetime('now', '-2 minutes') ORDER BY created_at DESC LIMIT 1"
  ).bind(session.userId).all<Pick<DatabaseRows["call_signals"], "id" | "caller_id" | "caller_name" | "target_user_id" | "room_name" | "status" | "created_at">>();
  return NextResponse.json({ incoming: results[0] || null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { signalId, status } = await req.json();
  if (typeof signalId !== "string" || !signalId || !["answered", "declined"].includes(status)) {
    return NextResponse.json({ error: "Invalid call response" }, { status: 400 });
  }
  const { env } = await getCloudflareContext({ async: true });
  const result = await env.DB.prepare(
    "UPDATE call_signals SET status = ? WHERE id = ? AND target_user_id = ? AND status = 'ringing' AND created_at > datetime('now', '-2 minutes')"
  ).bind(status, signalId, session.userId).run();
  if (!result.meta.changes) return NextResponse.json({ error: "This call invitation is no longer available." }, { status: 409 });
  return NextResponse.json({ success: true });
}
