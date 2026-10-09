import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";
import { isSuperAdmin } from "@/src/modules/admin/superadmin";
import {
  audienceSqlForUser,
  createAnnouncementNotifications,
  decorateAnnouncements,
  promoteDueAnnouncements,
  promoteBirthdayAnnouncements,
} from "@/src/modules/announcements/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingAttachment = {
  id?: string;
  type?: string;
  slot?: string;
  name?: string;
  sizeBytes?: number;
  mimeType?: string;
  storageKey?: string;
};

const STATUSES = new Set(["draft", "scheduled", "published", "archived"]);
const PRIORITIES = new Set(["low", "normal", "high"]);

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await promoteDueAnnouncements(db);
    // Birthday posts are generated on read as well as by the hourly cron, so the board is correct
    // even if the cron has not fired yet. Idempotent per person per year.
    await promoteBirthdayAnnouncements(db);
    
    // Bypass helper to explicitly fetch all user columns including role and email
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "email" | "first_name" | "role" | "department" | "id_document_path" | "password_hash" | "password_salt" | "password_algorithm" | "password_iterations" | "password_updated_at" | "email_verified_at" | "last_login_at" | "created_at" | "updated_at" | "date_of_birth" | "otp" | "otp_expiry" | "last_name" | "avatar_url" | "phone" | "job_title">>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Administrators manage every announcement. Super admins (the three designated emails) bypass
    // the audience filter too, so they always see the full company feed including drafts.
    const isAdmin = user.role?.toLowerCase() === "admin" || isSuperAdmin(user.email);

    let rows: (DatabaseRows["announcements"] & {author_name:string})[] = [];
    if (isAdmin) {
      const result = await db.prepare(`
        SELECT a.*,
               COALESCE(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), u.email) AS author_name
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        ORDER BY a.pinned DESC,
                 CASE a.status WHEN 'published' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
                 COALESCE(a.published_at, a.scheduled_at, a.created_at) DESC
      `).all<Pick<DatabaseRows["announcements"], "id" | "title" | "content" | "author_id" | "priority" | "created_at" | "category" | "status" | "audience_type" | "audience_value" | "scheduled_at" | "published_at" | "pinned" | "reactions_enabled" | "require_acknowledgement" | "archived_at" | "updated_at" | "target_department" | "target_job_title"> & {"author_name":string}>();
      rows = result.results;
    } else {
      const audience = audienceSqlForUser(user);
      const result = await db.prepare(`
        SELECT a.*,
               COALESCE(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), u.email) AS author_name
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        WHERE a.status IN ('published','archived')
          AND ${audience.clause}
        ORDER BY a.pinned DESC, COALESCE(a.published_at, a.created_at) DESC
      `).bind(...audience.binds).all<Pick<DatabaseRows["announcements"], "id" | "title" | "content" | "author_id" | "priority" | "created_at" | "category" | "status" | "audience_type" | "audience_value" | "scheduled_at" | "published_at" | "pinned" | "reactions_enabled" | "require_acknowledgement" | "archived_at" | "updated_at" | "target_department" | "target_job_title"> & {"author_name":string}>();
      rows = result.results;
    }

    const announcements = await decorateAnnouncements(db, rows, session.userId);
    return NextResponse.json({ announcements, canManage: isAdmin });
  } catch (error) {
    console.error("Announcements GET error", error);
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Bypass helper to explicitly fetch all user columns including role and email
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "email" | "first_name" | "role" | "department" | "id_document_path" | "password_hash" | "password_salt" | "password_algorithm" | "password_iterations" | "password_updated_at" | "email_verified_at" | "last_login_at" | "created_at" | "updated_at" | "date_of_birth" | "otp" | "otp_expiry" | "last_name" | "avatar_url" | "phone" | "job_title">>();
    const isAdmin = user?.role?.toLowerCase() === "admin";
    
    if (!user || !isAdmin) {
      return NextResponse.json({ error: "Only administrators can create announcements" }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim().slice(0, 150);
    const content = String(body.content || "").trim().slice(0, 10000);
    const category = String(body.category || "general").trim().slice(0, 60) || "general";
    const priority = PRIORITIES.has(body.priority) ? body.priority : "normal";
    const status = STATUSES.has(body.status) ? body.status : "draft";
    // Targeting now lives in target_department / target_job_title. New rows keep the legacy
    // audience_type at 'company' so the retained legacy clause never conflicts with the new one.
    const audienceType = "company";
    const audienceValue = null;
    const targetDepartment = String(body.targetDepartment || "All").trim().slice(0, 120) || "All";
    const targetJobTitle = String(body.targetJobTitle || "All").trim().slice(0, 120) || "All";
    const scheduledAt = status === "scheduled" ? normalizeDate(body.scheduledAt) : null;
    const pinned = body.pinned ? 1 : 0;
    const reactionsEnabled = body.reactionsEnabled === false ? 0 : 1;
    const requireAcknowledgement = body.requireAcknowledgement ? 1 : 0;
    const attachments = Array.isArray(body.attachments) ? body.attachments as IncomingAttachment[] : [];

    if (!title || !content) return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    if (status === "scheduled" && !scheduledAt) return NextResponse.json({ error: "Choose a valid publishing date and time" }, { status: 400 });

    const announcementId = crypto.randomUUID();
    const publishedAt = status === "published" ? new Date().toISOString() : null;

    await db.prepare(`
      INSERT INTO announcements (
        id, title, content, author_id, priority, category, status,
        audience_type, audience_value, target_department, target_job_title,
        scheduled_at, published_at,
        pinned, reactions_enabled, require_acknowledgement, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      announcementId, title, content, session.userId, priority, category, status,
      audienceType, audienceValue, targetDepartment, targetJobTitle, scheduledAt, publishedAt,
      pinned, reactionsEnabled, requireAcknowledgement
    ).run();

    await persistAnnouncementAttachments(db, attachments, announcementId, session.userId);

    if (status === "published") {
      await createAnnouncementNotifications(db, {
        id: announcementId,
        title,
        audience_type: audienceType,
        audience_value: audienceValue,
        target_department: targetDepartment,
        target_job_title: targetJobTitle,
      }, session.userId);
    }

    return NextResponse.json({ success: true, announcementId });
  } catch (error) {
    console.error("Announcements POST error", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}

async function persistAnnouncementAttachments(db: D1Database, attachments: IncomingAttachment[], announcementId: string, userId: string) {
  let coverUsed = false;
  for (const item of attachments.slice(0, 8)) {
    if (!(item.type === "image" || item.type === "video" || item.type === "document")) continue;
    if (!item.storageKey || !item.storageKey.startsWith(`collaboration/${userId}/`)) continue;
    const slot = item.slot === "cover" && item.type === "image" && !coverUsed ? "cover" : "attachment";
    if (slot === "cover") coverUsed = true;
    await db.prepare(`
      INSERT INTO announcement_attachments
        (id, announcement_id, uploaded_by, kind, slot, filename, mime_type, size_bytes, storage_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id || crypto.randomUUID(), announcementId, userId, item.type, slot,
      String(item.name || "Attachment").slice(0, 240), item.mimeType || null,
      Number(item.sizeBytes || 0), item.storageKey
    ).run();
  }
}

function normalizeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}