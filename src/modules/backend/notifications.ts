import crypto from "crypto";

export type NotificationInput = {
  userId: string;
  content: string;
  kind?: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
  id?: string;
};

export async function createNotification(db: D1Database, input: NotificationInput) {
  await db.prepare(`
    INSERT OR IGNORE INTO notifications
      (id, user_id, text, type, link, is_read, kind, entity_type, entity_id, actor_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).bind(
    input.id || crypto.randomUUID(),
    input.userId,
    input.content,
    input.kind || "general",
    input.entityType === "training" ? "/dashboard/training" : "/dashboard",
    input.kind || "general",
    input.entityType || null,
    input.entityId || null,
    input.actorId || null,
    input.metadata ? JSON.stringify(input.metadata) : null,
  ).run();
}

export async function markAllNotificationsRead(db: D1Database, userId: string) {
  await db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
    WHERE user_id = ? AND is_read = 0
  `).bind(userId).run();
}