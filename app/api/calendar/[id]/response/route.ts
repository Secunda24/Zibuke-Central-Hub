import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import {accessibleChannel} from '@/src/modules/backend/access';
import { createNotification } from "@/src/modules/backend/notifications";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  try {
    const { response } = await request.json();
    if (!["accepted", "tentative", "declined"].includes(response)) return NextResponse.json({ error: "Invalid response" }, { status: 400 });

    const event = await db.prepare("SELECT id, organizer_id, channel_id, event_type FROM events WHERE id = ? AND cancelled_at IS NULL").bind(id).first<Pick<DatabaseRows["events"], "id" | "organizer_id" | "channel_id" | "event_type">>();
    if (!event) return NextResponse.json({ error: "Calendar item not found" }, { status: 404 });
    if (event.organizer_id === session.userId) return NextResponse.json({ error: "Organisers are automatically accepted" }, { status: 400 });

    const invited = await db.prepare("SELECT user_id FROM event_attendees WHERE event_id = ? AND user_id = ?").bind(id, session.userId).first<Pick<DatabaseRows["event_attendees"], "user_id">>();
    if (!invited && !(event.channel_id ? await accessibleChannel(db,event.channel_id,session.userId) : event.event_type==='event')) return NextResponse.json({ error: "You are not invited to this session" }, { status: 403 });

    await db.prepare(`
      INSERT INTO event_attendees (event_id, user_id, response, responded_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(event_id, user_id) DO UPDATE SET response = excluded.response, responded_at = CURRENT_TIMESTAMP
    `).bind(id, session.userId, response).run();

    const responder = await db.prepare(`
      SELECT COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS display_name
      FROM users WHERE id = ?
    `).bind(session.userId).first<{"display_name":string}>();
    await createNotification(db, {
      id: `event-response:${id}:${session.userId}:${response}`,
      userId: event.organizer_id,
      content: `${responder?.display_name || "An invitee"} responded ${response} to your calendar invite`,
      kind: "event_response",
      entityType: "event",
      entityId: id,
      actorId: session.userId,
      metadata: { response },
    });

    return NextResponse.json({ success: true, response });
  } catch (error) {
    console.error("Calendar response error", error);
    return NextResponse.json({ error: "Could not update invitation response" }, { status: 500 });
  }
}
