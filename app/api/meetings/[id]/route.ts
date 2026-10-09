import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { createMeetingRoomId, DEFAULT_MEETING_PROVIDER } from "@/src/modules/backend/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const { id } = await params;

  try {
    const user = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "role">>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const meeting = await db.prepare(`
      SELECT e.*,
             COALESCE(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), u.email) AS organizer_name,
             c.name AS channel_name,
             c.visibility AS channel_visibility,
             ea.response AS attendee_response,
             CASE WHEN cm.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_channel_member
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      LEFT JOIN channels c ON c.id = e.channel_id
      LEFT JOIN event_attendees ea ON ea.event_id = e.id AND ea.user_id = ?
      LEFT JOIN channel_members cm ON cm.channel_id = e.channel_id AND cm.user_id = ?
      WHERE e.id = ?
    `).bind(session.userId, session.userId, id).first<Pick<DatabaseRows["events"], "id" | "title" | "description" | "start_time" | "end_time" | "organizer_id" | "department" | "created_at" | "event_type" | "channel_id" | "online" | "recording_url" | "recording_duration_seconds" | "cancelled_at" | "meeting_provider" | "meeting_room"> & {"organizer_name":string;"channel_name":string;"channel_visibility":string;"attendee_response":string;"is_channel_member":number}>();

    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

    const canAccess = user.role === "admin"
      || meeting.organizer_id === session.userId
      || Boolean(meeting.attendee_response)
      || Boolean(meeting.is_channel_member)
      || meeting.channel_visibility === "company";

    if (!canAccess) return NextResponse.json({ error: "You do not have access to this meeting" }, { status: 403 });

    if (meeting.online && !meeting.meeting_room) {
      const room = createMeetingRoomId();
      await db.prepare(`
        UPDATE events SET meeting_provider = ?, meeting_room = ? WHERE id = ?
      `).bind(DEFAULT_MEETING_PROVIDER, room, id).run();
      meeting.meeting_provider = DEFAULT_MEETING_PROVIDER;
      meeting.meeting_room = room;
    }

    const now = Date.now();
    const end = new Date(meeting.end_time).getTime();
    const canJoin = Boolean(meeting.online)
      && !meeting.cancelled_at
      && Number.isFinite(end)
      && now < end
      && meeting.attendee_response !== "declined";

    return NextResponse.json({
      meeting,
      permissions: {
        canJoin,
        canManage: user.role === "admin" || meeting.organizer_id === session.userId,
      },
      media: {
        provider: meeting.meeting_provider || DEFAULT_MEETING_PROVIDER,
        roomName: meeting.meeting_room || null,
        domain: process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si",
      },
    });
  } catch (error) {
    console.error("Meeting access GET error", error);
    return NextResponse.json({ error: "Failed to load meeting" }, { status: 500 });
  }
}
