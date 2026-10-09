import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

import { verifySession } from "@/src/modules/auth/session";
import { createNotification, markAllNotificationsRead } from "@/src/modules/backend/notifications";
import { expandOccurrences } from "@/src/modules/calendar/recurrence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  try {
    const { results: dueEvents } = await db.prepare(`
      SELECT e.id, e.title, e.start_time, e.end_time, e.recurrence_type, e.recurrence_day, e.recurrence_end_date
      FROM events e
      WHERE e.cancelled_at IS NULL
        AND (
          (datetime(e.start_time) > datetime('now') AND datetime(e.start_time) <= datetime('now', '+60 minutes'))
          -- recurring series that began earlier are fetched too, so an occurrence landing inside the
          -- next hour still produces a reminder
          OR (e.recurrence_type != 'none' AND datetime(e.start_time) <= datetime('now', '+60 minutes'))
        )
        AND (
          e.organizer_id = ?
          OR EXISTS (
            SELECT 1 FROM event_attendees ea
            WHERE ea.event_id = e.id AND ea.user_id = ? AND ea.response != 'declined'
          )
        )
    `).bind(userId, userId).all<Pick<DatabaseRows["events"], "id" | "title" | "start_time" | "end_time" | "recurrence_type" | "recurrence_day" | "recurrence_end_date">>();

    // Reminders are keyed by occurrence so a recurring series reminds once per occurrence.
    const nowWall = new Date().toISOString().slice(0, 16);
    const soonWall = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
    for (const event of dueEvents) {
      const occurrences = expandOccurrences(event, nowWall, soonWall);
      const starts = occurrences.length ? occurrences.map((occurrence) => occurrence.start) : [event.start_time];
      for (const startTime of starts) {
        await createNotification(db, {
          id: `event-reminder:${event.id}:${userId}:${startTime}`,
          userId,
          content: `Reminder: ${event.title} starts soon`,
          kind: "event_reminder",
          entityType: "event",
          entityId: event.id,
          metadata: { startTime },
        });
      }
    }

    // FIX: Replaced "message AS content" with "text AS content" 
    const { results } = await db.prepare(`
      SELECT id, user_id, text AS content, type, link, is_read, kind, entity_type, entity_id, actor_id,
             metadata_json, read_at, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).bind(userId).all<Pick<DatabaseRows["notifications"], "id" | "user_id" | "type" | "link" | "is_read" | "kind" | "entity_type" | "entity_id" | "actor_id" | "metadata_json" | "read_at" | "created_at"> & {"content":string}>();

    const notifications = (results).map((item) => ({
      ...item,
      metadata: safeJson(item.metadata_json),
    }));
    const unreadCount = notifications.filter((item) => item.is_read === 0).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications GET error", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const notificationId = typeof body.id === "string" ? body.id : null;

    if (notificationId) {
      await db.prepare(`
        UPDATE notifications
        SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = ? AND user_id = ?
      `).bind(notificationId, session.userId).run();
    } else {
      await markAllNotificationsRead(db, session.userId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications PATCH error", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

function safeJson(value: unknown) {
  if (!value || typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}