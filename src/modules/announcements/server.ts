import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { createNotification } from "@/src/modules/backend/notifications";

export async function getCurrentDbUser(db: D1Database, userId: string) {
  return db.prepare(`
    SELECT id,
           COALESCE(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), email) AS name,
           role, department, job_title
    FROM users WHERE id = ?
  `).bind(userId).first<Pick<DatabaseRows["users"], "id" | "role" | "department" | "job_title"> & {"name":string}>();
}

export async function promoteDueAnnouncements(db: D1Database) {
  const { results } = await db.prepare(`
    SELECT id, title, author_id, audience_type, audience_value, target_department, target_job_title
    FROM announcements
    WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND datetime(scheduled_at) <= datetime('now')
  `).all<Pick<DatabaseRows["announcements"], "id" | "title" | "author_id" | "audience_type" | "audience_value" | "target_department" | "target_job_title">>();

  for (const row of results) {
    await db.prepare(`
      UPDATE announcements
      SET status = 'published', published_at = COALESCE(published_at, datetime('now')), updated_at = datetime('now')
      WHERE id = ? AND status = 'scheduled'
    `).bind(row.id).run();
    await createAnnouncementNotifications(db, row, row.author_id);
  }
}

/** Stable R2 key of the branded cover used by every birthday post. */
const BIRTHDAY_COVER_KEY = "birthday/happy-birthday.svg";

/**
 * Posts one announcement for each employee whose birthday is today. Idempotent by construction: the
 * announcement id is deterministic per person per year and inserted with OR IGNORE, so the hourly
 * cron and any number of simultaneous page loads still produce exactly one post each.
 */
export async function promoteBirthdayAnnouncements(db: D1Database): Promise<number> {
  const author = await db
    .prepare("SELECT id FROM users WHERE role = 'admin' AND archived_at IS NULL ORDER BY created_at LIMIT 1")
    .first<Pick<DatabaseRows["users"], "id">>();
  if (!author) return 0;

  const { results } = await db
    .prepare(`
      SELECT u.id,
             COALESCE(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), u.email) AS name,
             u.first_name,
             strftime('%Y', 'now') AS year
      FROM users u
      WHERE u.archived_at IS NULL
        AND u.date_of_birth IS NOT NULL AND TRIM(u.date_of_birth) <> ''
        AND strftime('%m-%d', u.date_of_birth) = strftime('%m-%d', 'now')
    `)
    .all<{ id: string; name: string; first_name: string | null; year: string }>();

  let created = 0;
  for (const person of results) {
    const announcementId = `birthday-${person.id}-${person.year}`;
    const firstName = (person.first_name || person.name || "there").trim();
    const insert = await db
      .prepare(`
        INSERT OR IGNORE INTO announcements
          (id, title, content, author_id, priority, category, status, audience_type, audience_value,
           target_department, target_job_title, pinned, reactions_enabled, require_acknowledgement,
           published_at, updated_at)
        VALUES (?, ?, ?, ?, 'normal', 'Celebration', 'published', 'company', NULL, 'All', 'All', 0, 1, 0,
                datetime('now'), datetime('now'))
      `)
      .bind(
        announcementId,
        `Happy Birthday, ${firstName}!`,
        `Please join us in wishing ${person.name} a very happy birthday today. 🎉`,
        author.id
      )
      .run();
    if (!insert.meta.changes) continue;
    created += 1;
    await db
      .prepare(`
        INSERT OR IGNORE INTO announcement_attachments
          (id, announcement_id, uploaded_by, kind, slot, filename, mime_type, size_bytes, storage_key)
        VALUES (?, ?, ?, 'image', 'cover', 'happy-birthday.svg', 'image/svg+xml', 0, ?)
      `)
      .bind(crypto.randomUUID(), announcementId, author.id, BIRTHDAY_COVER_KEY)
      .run();
  }
  return created;
}

export async function createAnnouncementNotifications(db: D1Database, announcement: {
  id: string;
  title: string;
  audience_type?: string | null;
  audience_value?: string | null;
  target_department?: string | null;
  target_job_title?: string | null;
}, authorId: string) {
  const users = await audienceUsers(db, announcement, authorId);
  for (const user of users) {
    await createNotification(db, {
      id: `announcement:${announcement.id}:${user.id}`,
      userId: user.id,
      content: `New announcement: ${announcement.title}`,
      kind: "announcement",
      entityType: "announcement",
      entityId: announcement.id,
      actorId: authorId,
      metadata: { title: announcement.title },
    });
  }
}

// Recipients are resolved with the SAME rule the feed uses, evaluated per user in SQL. There is
// deliberately no catch-all branch: an unrecognised audience type resolves to nobody rather than
// broadcasting to the whole company.
async function audienceUsers(db: D1Database, announcement: {
  audience_type?: string | null;
  audience_value?: string | null;
  target_department?: string | null;
  target_job_title?: string | null;
}, authorId: string) {
  const audienceType = announcement.audience_type || "company";
  const audienceValue = announcement.audience_value || null;
  const targetDepartment = announcement.target_department || "All";
  const targetJobTitle = announcement.target_job_title || "All";
  const { results } = await db.prepare(`
    SELECT u.id FROM users u
    WHERE u.id != ?
      AND u.archived_at IS NULL
      AND (? = 'company' OR (? = 'department' AND ? = u.department) OR (? = 'role' AND ? = u.role))
      AND (? = 'All' OR ? = u.department)
      AND (? = 'All' OR ? = COALESCE(u.job_title, ''))
  `).bind(
    authorId,
    audienceType, audienceType, audienceValue, audienceType, audienceValue,
    targetDepartment, targetDepartment,
    targetJobTitle, targetJobTitle
  ).all<Pick<DatabaseRows["users"], "id">>();
  return results;
}

export function audienceSqlForUser(user: { role: string; department: string; job_title?: string | null }) {
  // The legacy audience clause is kept ANDed as defence in depth: rows created before the
  // Department/Job Title columns existed still carry their real audience in audience_type/value,
  // so a department- or role-targeted legacy announcement can never widen to everyone.
  return {
    clause: `(a.audience_type = 'company' OR (a.audience_type = 'department' AND a.audience_value = ?) OR (a.audience_type = 'role' AND a.audience_value = ?))
      AND (a.target_department = 'All' OR a.target_department = ?)
      AND (a.target_job_title = 'All' OR a.target_job_title = COALESCE(?, ''))`,
    binds: [user.department, user.role, user.department, user.job_title ?? ""],
  };
}

export async function decorateAnnouncements(db: D1Database, rows: (DatabaseRows["announcements"] & {author_name?:string})[], currentUserId: string) {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");

  const [attachmentQuery, reactionQuery, acknowledgementQuery, viewQuery] = await Promise.all([
    db.prepare(`
      SELECT id, announcement_id, kind, slot, filename, mime_type, size_bytes
      FROM announcement_attachments
      WHERE announcement_id IN (${placeholders})
      ORDER BY CASE WHEN slot = 'cover' THEN 0 ELSE 1 END, created_at ASC
    `).bind(...ids).all<Pick<DatabaseRows["announcement_attachments"], "id" | "announcement_id" | "kind" | "slot" | "filename" | "mime_type" | "size_bytes">>(),
    db.prepare(`
      SELECT announcement_id, emoji, user_id
      FROM announcement_reactions
      WHERE announcement_id IN (${placeholders})
    `).bind(...ids).all<Pick<DatabaseRows["announcement_reactions"], "announcement_id" | "emoji" | "user_id">>(),
    db.prepare(`
      SELECT announcement_id, user_id
      FROM announcement_acknowledgements
      WHERE announcement_id IN (${placeholders})
    `).bind(...ids).all<Pick<DatabaseRows["announcement_acknowledgements"], "announcement_id" | "user_id">>(),
    db.prepare(`
      SELECT announcement_id, COUNT(*) AS unique_views, COALESCE(SUM(view_count), 0) AS total_views
      FROM announcement_views
      WHERE announcement_id IN (${placeholders})
      GROUP BY announcement_id
    `).bind(...ids).all<Pick<DatabaseRows["announcement_views"], "announcement_id"> & {"unique_views":number;"total_views":number}>(),
  ]);

  const attachmentsByAnnouncement = new Map<string, {id:string;kind:string;slot:string;filename:string;mime_type:string|null;size_bytes:number|null;url:string}[]>();
  for (const item of attachmentQuery.results) {
    const list = attachmentsByAnnouncement.get(item.announcement_id) || [];
    list.push({
      id: item.id,
      kind: item.kind,
      slot: item.slot,
      filename: item.filename,
      mime_type: item.mime_type,
      size_bytes: item.size_bytes,
      url: `/api/announcement-attachments/${item.id}`,
    });
    attachmentsByAnnouncement.set(item.announcement_id, list);
  }

  const reactionsByAnnouncement = new Map<string, Map<string, { count: number; reactedByMe: boolean }>>();
  for (const item of reactionQuery.results) {
    const byEmoji = reactionsByAnnouncement.get(item.announcement_id) || new Map();
    const current = byEmoji.get(item.emoji) || { count: 0, reactedByMe: false };
    current.count += 1;
    if (item.user_id === currentUserId) current.reactedByMe = true;
    byEmoji.set(item.emoji, current);
    reactionsByAnnouncement.set(item.announcement_id, byEmoji);
  }

  const acknowledgementCount = new Map<string, number>();
  const acknowledgedByMe = new Set<string>();
  for (const item of acknowledgementQuery.results) {
    acknowledgementCount.set(item.announcement_id, (acknowledgementCount.get(item.announcement_id) || 0) + 1);
    if (item.user_id === currentUserId) acknowledgedByMe.add(item.announcement_id);
  }


  const viewsByAnnouncement = new Map<string, { uniqueViews: number; totalViews: number }>();
  for (const item of viewQuery.results) {
    viewsByAnnouncement.set(item.announcement_id, {
      uniqueViews: Number(item.unique_views || 0),
      totalViews: Number(item.total_views || 0),
    });
  }

  return rows.map((row) => ({
    ...row,
    attachments: attachmentsByAnnouncement.get(row.id) || [],
    reactions: Array.from(reactionsByAnnouncement.get(row.id)?.entries() || []).map(([emoji, value]) => ({ emoji, ...value })),
    acknowledgedByMe: acknowledgedByMe.has(row.id),
    acknowledgementCount: acknowledgementCount.get(row.id) || 0,
    uniqueViews: viewsByAnnouncement.get(row.id)?.uniqueViews || 0,
    totalViews: viewsByAnnouncement.get(row.id)?.totalViews || 0,
  }));
}
