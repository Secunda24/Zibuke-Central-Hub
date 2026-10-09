import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { createNotification } from "@/src/modules/backend/notifications";
import { createMeetingRoomId, DEFAULT_MEETING_PROVIDER } from "@/src/modules/backend/meetings";
import { upsertChannelMeetingCard, validateEventInput } from "../route";
import { calculateAvailability } from "@/src/modules/calendar/availability";

export const runtime = "nodejs";

async function getContext(request: NextRequest, id: string) {
  const session = await verifySession(request.cookies);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) return { error: NextResponse.json({ error: "Database binding missing" }, { status: 500 }) };

  // FIX: Aligned with your exact schema (removed non-existent 'name' column)
  const user = await db.prepare(`
    SELECT id, role, department, job_title,
           COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS display_name
    FROM users WHERE id = ?
  `).bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "role" | "department" | "job_title"> & {"display_name":string}>();
  
  const event = await db.prepare(`
    SELECT e.*,
           COALESCE(TRIM(COALESCE(organizer.first_name, '') || ' ' || COALESCE(organizer.last_name, '')), organizer.email) AS organizer_name
    FROM events e
    JOIN users organizer ON organizer.id = e.organizer_id
    WHERE e.id = ? AND e.cancelled_at IS NULL
  `).bind(id).first<Pick<DatabaseRows["events"], "id" | "title" | "description" | "start_time" | "end_time" | "organizer_id" | "department" | "created_at" | "event_type" | "channel_id" | "online" | "recording_url" | "recording_duration_seconds" | "cancelled_at" | "meeting_provider" | "meeting_room"> & {"organizer_name":string}>();
  
  if (!event) return { error: NextResponse.json({ error: "Calendar item not found" }, { status: 404 }) };
  if (!user || (user.role !== "admin" && event.organizer_id !== session.userId)) {
    return { error: NextResponse.json({ error: "Only the organiser or an administrator can change this calendar item" }, { status: 403 }) };
  }
  return { db, user, event, session };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getContext(request, id);
  if ("error" in context) return context.error;

  try {
    const body = await request.json();
    const validation = await validateEventInput(context.db, body, context.user.role, context.event.organizer_id, context.user.job_title);
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });

    if (validation.eventType !== "event") {
      const availability = await calculateAvailability(
        context.db,
        [context.event.organizer_id, ...(validation.inviteeIds || [])],
        validation.startTime!,
        validation.endTime!,
        id,
        true,
      );
      if (!availability.available) {
        return NextResponse.json({
          error: "The selected time conflicts with one or more participant calendars.",
          code: "CALENDAR_CONFLICT",
          availability,
        }, { status: 409 });
      }
    }

    const meetingRoom = validation.online ? (context.event.meeting_room || createMeetingRoomId()) : null;
    await context.db.prepare(`
      UPDATE events
      SET title = ?, description = ?, start_time = ?, end_time = ?, event_type = ?, channel_id = ?, online = ?,
          meeting_provider = ?, meeting_room = ?, recurrence_type = ?, recurrence_day = ?, recurrence_end_date = ?
      WHERE id = ?
    `).bind(
      validation.title,
      validation.description,
      validation.startTime,
      validation.endTime,
      validation.eventType,
      validation.channelId,
      validation.online ? 1 : 0,
      validation.online ? DEFAULT_MEETING_PROVIDER : null,
      meetingRoom,
      validation.recurrenceType,
      validation.recurrenceDay,
      validation.recurrenceEndDate,
      id
    ).run();

    const { results: existingAttendees } = await context.db.prepare(
      "SELECT user_id, response, responded_at FROM event_attendees WHERE event_id = ?"
    ).bind(id).all<Pick<DatabaseRows["event_attendees"], "user_id" | "response" | "responded_at">>();
    const existingResponses = new Map((existingAttendees).map((row) => [row.user_id, row]));

    await context.db.prepare("DELETE FROM event_attendees WHERE event_id = ?").bind(id).run();
    for (const inviteeId of validation.inviteeIds || []) {
      const previous = existingResponses.get(inviteeId);
      await context.db.prepare(`
        INSERT INTO event_attendees (event_id, user_id, response, responded_at)
        VALUES (?, ?, ?, ?)
      `).bind(id, inviteeId, previous?.response || "pending", previous?.responded_at || null).run();
      const notificationId = previous ? `event-update:${id}:${inviteeId}:${Date.now()}` : `event-invite:${id}:${inviteeId}`;
      const message = previous ? `Calendar updated: ${validation.title}` : `Calendar invite: ${validation.title}`;
      await createNotification(context.db, {
        id: notificationId,
        userId: inviteeId,
        content: message,
        kind: previous ? "event_update" : "event_invite",
        entityType: "event",
        entityId: id,
        actorId: context.session.userId,
        metadata: { startTime: validation.startTime, endTime: validation.endTime, eventType: validation.eventType },
      });
    }

    if (validation.channelId) {
      await upsertChannelMeetingCard(context.db, {
        eventId: id,
        channelId: validation.channelId,
        senderId: context.event.organizer_id,
        title: validation.title!,
        description: validation.description!,
        startTime: validation.startTime!,
        endTime: validation.endTime!,
        eventType: validation.eventType!,
        organizerName: context.event.organizer_name || context.user.display_name,
        online: validation.online!,
        meetingRoom,
      });
    } else {
      await context.db.prepare("DELETE FROM channel_messages WHERE event_id = ?").bind(id).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar PATCH error", error);
    return NextResponse.json({ error: "Failed to update calendar item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getContext(request, id);
  if ("error" in context) return context.error;

  try {
    await context.db.prepare("UPDATE events SET cancelled_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    const { results: attendees } = await context.db.prepare("SELECT user_id FROM event_attendees WHERE event_id = ?").bind(id).all<Pick<DatabaseRows["event_attendees"], "user_id">>();
    for (const attendee of attendees) {
      await createNotification(context.db, {
        id: `event-cancelled:${id}:${attendee.user_id}`,
        userId: attendee.user_id,
        content: `Meeting cancelled: ${context.event.title}`,
        kind: "event_cancelled",
        entityType: "event",
        entityId: id,
        actorId: context.session.userId,
      });
    }

    const card = await context.db.prepare("SELECT metadata_json FROM channel_messages WHERE event_id = ?").bind(id).first<Pick<DatabaseRows["channel_messages"], "metadata_json">>();
    if (card) {
      let metadata: Record<string,unknown> = {};
      try { metadata = JSON.parse(card.metadata_json || "{}"); } catch { metadata = {}; }
      metadata.cancelled = true;
      await context.db.prepare(`
        UPDATE channel_messages
        SET message_type = 'meeting_cancelled', content = ?, metadata_json = ?
        WHERE event_id = ?
      `).bind(`cancelled: ${context.event.title}`, JSON.stringify(metadata), id).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar DELETE error", error);
    return NextResponse.json({ error: "Failed to cancel calendar item" }, { status: 500 });
  }
}