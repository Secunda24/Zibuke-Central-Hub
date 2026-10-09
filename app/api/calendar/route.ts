import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";
import { createNotification } from "@/src/modules/backend/notifications";
import { createMeetingRoomId, DEFAULT_MEETING_PROVIDER } from "@/src/modules/backend/meetings";
import { calculateAvailability } from "@/src/modules/calendar/availability";
import { expandOccurrences } from "@/src/modules/calendar/recurrence";
import {accessibleChannel} from '@/src/modules/backend/access';

export const runtime = "nodejs";

const WORKER_MAX_DURATION_MINUTES = 60;
const WORKER_BOOKING_HORIZON_DAYS = 30;
// Job titles trusted to book beyond the worker limits. This grants CALENDAR latitude only: it is
// not an admin role, and never unlocks organisation events, Access Management or the Training
// Wizard. Add or remove a title here rather than granting admin for scheduling.
const SCHEDULER_TITLES = new Set([
  "Marketing Manager",
  "Head of Signaling",
  "Community Relations Manager",
  "Signaling Manager",
  "Technician Manager",
]);

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  try {
    const currentUser = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "role">>();
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const baseSelect = `
      SELECT e.*,
             COALESCE(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), u.email) AS organizer_name,
             c.name AS channel_name,
             CASE
               WHEN e.organizer_id = ? THEN 'accepted'
               WHEN ea.response IS NOT NULL THEN ea.response
               WHEN e.event_type = 'event' THEN 'accepted'
               WHEN e.channel_id IS NOT NULL THEN 'pending'
               ELSE NULL
             END AS response_status,
             (SELECT COUNT(*) FROM event_attendees ec WHERE ec.event_id = e.id) + 1 AS attendee_count,
             (SELECT json_group_array(user_id) FROM event_attendees WHERE event_id = e.id) AS invitee_ids_json
      FROM events e
      JOIN users u ON u.id = e.organizer_id
      LEFT JOIN channels c ON c.id = e.channel_id
      LEFT JOIN event_attendees ea ON ea.event_id = e.id AND ea.user_id = ?
      WHERE e.cancelled_at IS NULL
    `;

    const statement = currentUser.role === "admin"
      ? db.prepare(`${baseSelect} ORDER BY e.start_time ASC`).bind(session.userId, session.userId)
      : db.prepare(`${baseSelect}
          AND (
            e.organizer_id = ?
            OR (e.event_type = 'event' AND e.channel_id IS NULL)
            OR (c.archived_at IS NULL AND (c.visibility='company' OR c.created_by=? OR EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id=e.channel_id AND cm.user_id=?)))
            OR ea.user_id IS NOT NULL
          )
          ORDER BY e.start_time ASC
        `).bind(session.userId, session.userId, session.userId,session.userId,session.userId);

    const { results } = await statement.all<DatabaseRows["events"] & {invitee_ids_json?:string}>();
    
    // Parse the JSON array from SQLite so the frontend can read it
    const formattedEvents = results.map((ev) => {
      let invitees = [];
      try { invitees = JSON.parse(ev.invitee_ids_json || "[]"); } catch (e) {}
      
      delete ev.invitee_ids_json;
      
      return {
        ...ev,
        invitee_ids: invitees
      };
    });

    // Expand recurring series into their occurrences so every instance renders on the grid. A series
    // row is replaced by its instances (never shown twice). The window is deliberately wide because
    // the client loads the calendar once and then navigates weeks locally.
    const wall = (value: Date) => value.toISOString().slice(0, 16);
    const windowStart = wall(new Date(Date.now() - 60 * 86400000));
    const windowEnd = wall(new Date(Date.now() + 400 * 86400000));
    const expanded: (typeof formattedEvents[number] & {
      series_id?: string;
      series_start_time?: string;
      series_end_time?: string;
      is_recurrence_instance?: boolean;
    })[] = [];
    for (const item of formattedEvents) {
      const occurrences = expandOccurrences(item, windowStart, windowEnd);
      if (!occurrences.length) { expanded.push(item); continue; }
      for (const occurrence of occurrences) {
        expanded.push({
          ...item,
          id: `${item.id}::${occurrence.start}`,
          series_id: item.id,
          series_start_time: item.start_time,
          series_end_time: item.end_time,
          start_time: occurrence.start,
          end_time: occurrence.end,
          is_recurrence_instance: true,
        });
      }
    }

    return NextResponse.json({ events: expanded });
  } catch (error) {
    console.error("Calendar GET error", error);
    return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  try {
    const body = await request.json();
    const user = await db.prepare(`
      SELECT id, role, department, job_title,
             COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS display_name
      FROM users WHERE id = ?
    `).bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "role" | "department" | "job_title"> & {"display_name":string}>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const validation = await validateEventInput(db, body, user.role, session.userId, user.job_title);
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 });

    const eventId = crypto.randomUUID();
    const eventType = validation.eventType!;
    const channelId = validation.channelId;
    const inviteeIds = validation.inviteeIds || [];

    if (eventType !== "event") {
      const availability = await calculateAvailability(
        db,
        [session.userId, ...inviteeIds],
        validation.startTime!,
        validation.endTime!,
        null,
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

    const meetingRoom = validation.online ? createMeetingRoomId() : null;

    await db.prepare(`
      INSERT INTO events
        (id, title, description, start_time, end_time, organizer_id, department, event_type, channel_id, online, meeting_provider, meeting_room, recurrence_type, recurrence_day, recurrence_end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      validation.title,
      validation.description,
      validation.startTime,
      validation.endTime,
      session.userId,
      user.department,
      eventType,
      channelId,
      validation.online ? 1 : 0,
      validation.online ? DEFAULT_MEETING_PROVIDER : null,
      meetingRoom,
      validation.recurrenceType,
      validation.recurrenceDay,
      validation.recurrenceEndDate
    ).run();

    for (const inviteeId of inviteeIds) {
      await db.prepare(`
        INSERT OR IGNORE INTO event_attendees (event_id, user_id, response)
        VALUES (?, ?, 'pending')
      `).bind(eventId, inviteeId).run();
      await createNotification(db, {
        id: `event-invite:${eventId}:${inviteeId}`,
        userId: inviteeId,
        content: `Calendar invite: ${validation.title}`,
        kind: "event_invite",
        entityType: "event",
        entityId: eventId,
        actorId: session.userId,
        metadata: { startTime: validation.startTime, endTime: validation.endTime, eventType },
      });
    }

    if (channelId) {
      await upsertChannelMeetingCard(db, {
        eventId,
        channelId,
        senderId: session.userId,
        title: validation.title!,
        description: validation.description!,
        startTime: validation.startTime!,
        endTime: validation.endTime!,
        eventType,
        organizerName: user.display_name,
        online: validation.online!,
        meetingRoom,
      });
    }

    return NextResponse.json({ success: true, eventId, meetingRoom, meetingProvider: validation.online ? DEFAULT_MEETING_PROVIDER : null, message: "Calendar item created" });
  } catch (error) {
    console.error("Calendar POST error", error);
    return NextResponse.json({ error: "Failed to schedule calendar item" }, { status: 500 });
  }
}

export async function validateEventInput(db: D1Database, body: Record<string,unknown>, role: string, organizerId: string, jobTitle?: string | null) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const startTime = String(body.start_time || "");
  const endTime = String(body.end_time || "");
  const eventType = ["meeting", "huddle", "event"].includes(String(body.event_type)) ? String(body.event_type) : "meeting";
  const channelId = body.channel_id ? String(body.channel_id) : null;
  const online = body.online !== false && eventType !== "event";
  const inviteeIds: string[] = Array.isArray(body.invitee_ids)
    ? Array.from(new Set<string>(body.invitee_ids.map((id: unknown) => String(id)).filter((id: string) => Boolean(id) && id !== organizerId))).slice(0, 100)
    : [];

  // Recurrence rule. 'none' means a single event and clears the other two fields.
  // 'daily' needs no day selection, so recurrence_day is only read for weekly/monthly.
  const recurrenceType = ["none", "daily", "weekly", "monthly"].includes(String(body.recurrence_type)) ? String(body.recurrence_type) : "none";
  const needsDay = recurrenceType === "weekly" || recurrenceType === "monthly";
  const recurrenceDay = needsDay ? Number(body.recurrence_day) : null;
  const recurrenceEndDate = recurrenceType === "none" ? null : String(body.recurrence_end_date || "").slice(0, 10) || null;

  if (!title || !startTime || !endTime) return { error: "Title, start time and end time are required" };
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) return { error: "End time must be after start time" };

  if (recurrenceType !== "none") {
    if (needsDay) {
      const lowerBound = recurrenceType === "weekly" ? 0 : 1;
      const upperBound = recurrenceType === "weekly" ? 6 : 31;
      if (!Number.isInteger(recurrenceDay) || (recurrenceDay as number) < lowerBound || (recurrenceDay as number) > upperBound) {
        return { error: recurrenceType === "weekly" ? "Choose the day of the week this repeats on" : "Choose the day of the month this repeats on" };
      }
    }
    if (!recurrenceEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(recurrenceEndDate)) return { error: "Choose when the repeat should end" };
    if (recurrenceEndDate < startTime.slice(0, 10)) return { error: "The repeat cannot end before the event starts" };
  }

  if (channelId) {
    const channel = await accessibleChannel(db,channelId,organizerId);
    if (!channel) return { error: "Selected channel no longer exists" };
  }

  if (role !== "admin") {
    if (eventType === "event") return { error: "Workers can create meetings and huddles; organisation events are administrator-managed" };
    // Trusted scheduling titles may book longer meetings and further ahead. The agenda and
    // invitee/channel requirements still apply to everyone — those are quality rules, not a
    // capability.
    if (!SCHEDULER_TITLES.has(String(jobTitle || "").trim())) {
      const durationMinutes = (end.getTime() - start.getTime()) / 60000;
      if (durationMinutes > WORKER_MAX_DURATION_MINUTES) return { error: `Worker-created meetings and huddles are limited to ${WORKER_MAX_DURATION_MINUTES} minutes` };
      const horizon = Date.now() + WORKER_BOOKING_HORIZON_DAYS * 86400000;
      if (start.getTime() > horizon) return { error: `Workers can schedule up to ${WORKER_BOOKING_HORIZON_DAYS} days ahead` };
    }
    if (!description) return { error: "Add a short agenda so invitees know what the session is for" };
    if (!channelId && inviteeIds.length === 0) return { error: "Invite at least one person or link the session to a channel" };
  }

  return { title, description, startTime, endTime, eventType, channelId, online, inviteeIds, recurrenceType, recurrenceDay, recurrenceEndDate };
}

export async function upsertChannelMeetingCard(db: D1Database, input: {
  eventId: string;
  channelId: string;
  senderId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  eventType: string;
  organizerName: string;
  online: boolean;
  meetingRoom?: string | null;
}) {
  const metadata = JSON.stringify({
    eventId: input.eventId,
    title: input.title,
    description: input.description,
    startTime: input.startTime,
    endTime: input.endTime,
    eventType: input.eventType,
    organizerName: input.organizerName,
    online: input.online,
    meetingRoom: input.meetingRoom || null,
    cancelled: false,
  });

  const existing = await db.prepare("SELECT id FROM channel_messages WHERE event_id = ?").bind(input.eventId).first<Pick<DatabaseRows["channel_messages"], "id">>();
  if (existing) {
    await db.prepare(`
      UPDATE channel_messages
      SET channel_id = ?, sender_id = ?, content = ?, message_type = 'meeting', metadata_json = ?
      WHERE id = ?
    `).bind(input.channelId, input.senderId, `${input.eventType} scheduled: ${input.title}`, metadata, existing.id).run();
    return;
  }

  await db.prepare(`
    INSERT INTO channel_messages (id, channel_id, sender_id, content, message_type, event_id, metadata_json)
    VALUES (?, ?, ?, ?, 'meeting', ?, ?)
  `).bind(crypto.randomUUID(), input.channelId, input.senderId, `${input.eventType} scheduled: ${input.title}`, input.eventId, metadata).run();
}
