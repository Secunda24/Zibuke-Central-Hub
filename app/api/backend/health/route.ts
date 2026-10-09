import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function tableExists(db: D1Database, name: string) {
  const row = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(name).first<{"name":string}>();
  return Boolean(row?.name);
}

async function columnSet(db: D1Database, table: string) {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((result.results || []).map((row) => String(row.name)));
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const bucket = env.COLLAB_BUCKET;

    if (!db) return NextResponse.json({ ok: false, d1: false, r2: Boolean(bucket), error: "Database binding missing" }, { status: 500 });
    await db.prepare("SELECT 1 AS ok").first<{"ok":string}>();

    const [hasChannelMembers, hasDirectReadState, hasAnnouncementViews] = await Promise.all([
      tableExists(db, "channel_members"),
      tableExists(db, "direct_read_state"),
      tableExists(db, "announcement_views"),
    ]);
    const [messageColumns, channelMessageColumns, eventColumns, notificationColumns, channelColumns] = await Promise.all([
      columnSet(db, "messages"),
      columnSet(db, "channel_messages"),
      columnSet(db, "events"),
      columnSet(db, "notifications"),
      columnSet(db, "channels"),
    ]);

    const backendFoundation = hasChannelMembers
      && hasDirectReadState
      && hasAnnouncementViews
      && channelColumns.has("archived_at")
      && eventColumns.has("meeting_room")
      && eventColumns.has("meeting_provider")
      && notificationColumns.has("kind");

    const messageLifecycle = messageColumns.has("reply_to_id")
      && messageColumns.has("edited_at")
      && messageColumns.has("deleted_at")
      && channelMessageColumns.has("edited_at")
      && channelMessageColumns.has("deleted_at");

    const [profiles, documents, challenges, courses, assignments, limits] = await Promise.all([
      tableExists(db, 'employee_profiles'), tableExists(db, 'employee_documents'), tableExists(db, 'login_challenges'),
      tableExists(db, 'learning_courses'), tableExists(db, 'learning_assignments'), tableExists(db, 'request_limits'),
    ]);
    const protections = await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all<{name:string}>();
    const training = courses && assignments && ['freeze_assigned_lessons','freeze_assigned_quizzes','assessment_prerequisites','quiz_attempt_rate_limit'].every(name => protections.results.some(row => row.name === name));
    const storage = { collaboration: Boolean(bucket), employeeDocuments: Boolean(env.EMPLOYEE_DOCUMENTS_BUCKET), avatars: Boolean(env.AVATARS_BUCKET) };
    const sessionSigning = Boolean(env.SESSION_SECRET);
    const ok = backendFoundation && messageLifecycle && profiles && documents && challenges && limits && training && sessionSigning && Object.values(storage).every(Boolean);
    return NextResponse.json({
      ok,
      sessionSigning,
      storage,
      d1: true,
      r2: Boolean(bucket),
      authenticatedUserId: session.userId,
      migrations: {
        backendFoundation,
        messageLifecycle,
        employeeDocuments: profiles && documents,
        loginOtp: challenges,
        training,
        requestLimits: limits,
      },
      capabilities: {
        channelOwnership: channelColumns.has("archived_at"),
        directReplyEditDelete: messageLifecycle,
        channelReplyEditDelete: messageLifecycle,
        meetingRooms: eventColumns.has("meeting_room"),
        structuredNotifications: notificationColumns.has("kind"),
        clickableNotifications: notificationColumns.has("entity_type") && notificationColumns.has("entity_id"),
        attachments: Boolean(bucket),
        calendarAvailability: true,
        automaticTimeSuggestions: true,
        finalConflictCheck: true,
      },
      meetingMedia: {
        provider: "livekit",
        configured: Boolean(env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.NEXT_PUBLIC_LIVEKIT_URL),
        browserMediaTestRequired: true,
      },
      emailOtp: { enabled: String(env.FIRST_LOGIN_OTP_ENABLED) === "true", configured: Boolean(env.RESEND_API_KEY && env.OTP_EMAIL_FROM), deliveryTestRequired: true },
      timestamp: new Date().toISOString(),
    }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Backend health error", error);
    return NextResponse.json({ ok: false, d1: false, error: "Backend health check failed. Run the production preflight to check configuration and migrations." }, { status: 500 });
  }
}
