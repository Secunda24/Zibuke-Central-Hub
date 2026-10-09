import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import {accessibleChannel} from '@/src/modules/backend/access';

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;

  const channel = await accessibleChannel(db,id,session.userId);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  await db.prepare(`
    INSERT INTO channel_members (channel_id, user_id, member_role, joined_at)
    VALUES (?, ?, 'member', CURRENT_TIMESTAMP)
    ON CONFLICT(channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
  `).bind(id, session.userId).run();

  return NextResponse.json({ success: true, joined: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;
  if(!await accessibleChannel(db,id,session.userId)) return NextResponse.json({error:'Channel not found'},{status:404});

  await db.prepare(`
    INSERT INTO channel_members (channel_id, user_id, member_role, joined_at, last_read_at)
    VALUES (?, ?, 'member', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
  `).bind(id, session.userId).run();

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;

  const membership = await db.prepare("SELECT member_role FROM channel_members WHERE channel_id = ? AND user_id = ?").bind(id, session.userId).first<Pick<DatabaseRows["channel_members"], "member_role">>();
  if (membership?.member_role === "owner") return NextResponse.json({ error: "The channel owner cannot leave the channel" }, { status: 400 });

  await db.prepare("DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?").bind(id, session.userId).run();
  return NextResponse.json({ success: true, joined: false });
}
