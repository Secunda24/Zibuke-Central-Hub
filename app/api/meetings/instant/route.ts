import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifySession } from "@/src/modules/auth/session";
import { createNotification } from "@/src/modules/backend/notifications";
import { createMeetingRoomId, DEFAULT_MEETING_PROVIDER } from "@/src/modules/backend/meetings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  try {
    const body = await request.json().catch(() => ({}));
    const user = await db.prepare(`
      SELECT id, department,
             COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS display_name
      FROM users WHERE id = ?
    `).bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "department"> & {"display_name":string}>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const title = String(body.title || "Instant meeting").trim().slice(0, 150) || "Instant meeting";
    const inviteeId = body.inviteeId ? String(body.inviteeId) : null;
    let validInvitee: string | null = null;
    if (inviteeId && inviteeId !== session.userId) {
      const invitee = await db.prepare("SELECT id FROM users WHERE id = ?").bind(inviteeId).first<Pick<DatabaseRows["users"], "id">>();
      if (invitee) validInvitee = inviteeId;
    }

    // If these two people already have an active instant huddle, reuse it.
    // This prevents each participant from accidentally creating a different
    // meeting/Jitsi room when both press "Meet" from their DM.
    if (validInvitee) {
      const existing = await db.prepare(`
        SELECT e.id, e.title, e.meeting_room, e.meeting_provider, e.start_time, e.end_time
        FROM events e
        JOIN event_attendees ea ON ea.event_id = e.id
        WHERE e.cancelled_at IS NULL
          AND e.online = 1
          AND e.event_type = 'huddle'
          AND e.description = 'Instant Zibuke Central meeting'
          AND e.meeting_room IS NOT NULL
          AND datetime(e.end_time) > datetime('now')
          AND (
            (e.organizer_id = ? AND ea.user_id = ? AND ea.response != 'declined')
            OR
            (e.organizer_id = ? AND ea.user_id = ? AND ea.response != 'declined')
          )
        ORDER BY datetime(e.start_time) DESC
        LIMIT 1
      `).bind(session.userId, validInvitee, validInvitee, session.userId).first<Pick<DatabaseRows["events"], "id" | "title" | "meeting_room" | "meeting_provider" | "start_time" | "end_time">>();

      if (existing?.id && existing?.meeting_room) {
        // If the current user is the invitee, treating their explicit Meet click
        // as acceptance keeps the calendar state aligned with the actual call.
        await db.prepare(`
          UPDATE event_attendees
          SET response = 'accepted', responded_at = CURRENT_TIMESTAMP
          WHERE event_id = ? AND user_id = ? AND response = 'pending'
        `).bind(existing.id, session.userId).run();

        return NextResponse.json({
          success: true,
          reused: true,
          eventId: existing.id,
          meetingRoom: existing.meeting_room,
          meetingProvider: existing.meeting_provider || DEFAULT_MEETING_PROVIDER,
          jitsiDomain: process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si',
        });
      }
    }

    const eventId = crypto.randomUUID();
    const meetingRoom = createMeetingRoomId();
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await db.prepare(`
      INSERT INTO events
        (id, title, description, start_time, end_time, organizer_id, department, event_type, online, meeting_provider, meeting_room)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'huddle', 1, ?, ?)
    `).bind(
      eventId,
      title,
      "Instant Zibuke Central meeting",
      start.toISOString(),
      end.toISOString(),
      session.userId,
      user.department || "General",
      DEFAULT_MEETING_PROVIDER,
      meetingRoom
    ).run();

    if (validInvitee) {
      await db.prepare(`
        INSERT OR IGNORE INTO event_attendees (event_id, user_id, response)
        VALUES (?, ?, 'pending')
      `).bind(eventId, validInvitee).run();
      await createNotification(db, {
        id: `event-invite:${eventId}:${validInvitee}`,
        userId: validInvitee,
        content: `Meeting invite: ${title}`,
        kind: "event_invite",
        entityType: "event",
        entityId: eventId,
        actorId: session.userId,
        metadata: { startTime: start.toISOString(), endTime: end.toISOString(), eventType: "huddle", instant: true, title },
      });
    }

    return NextResponse.json({
      success: true,
      eventId,
      meetingRoom,
      meetingProvider: DEFAULT_MEETING_PROVIDER,
      jitsiDomain: process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.jit.si",
    });
  } catch (error) {
    console.error("Instant meeting POST error", error);
    return NextResponse.json({ error: "Failed to create instant meeting" }, { status: 500 });
  }
}
