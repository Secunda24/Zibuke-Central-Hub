import type {DatabaseRows} from "@/src/modules/backend/database-rows";
export async function accessibleChannel(db: D1Database,channelId:string,userId:string) {
  return db.prepare(`SELECT c.* FROM channels c WHERE c.id=? AND c.archived_at IS NULL AND (
    COALESCE(c.visibility,'company')='company' OR c.created_by=? OR EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id=c.id AND m.user_id=?))`).bind(channelId,userId,userId).first<Pick<DatabaseRows["channels"], "id" | "name" | "description" | "created_by" | "created_at" | "visibility" | "archived_at">>();
}
export async function accessibleMessage(db: D1Database,type:string,id:string,userId:string) {
  if(type==='direct') return db.prepare('SELECT id FROM messages WHERE id=? AND deleted_at IS NULL AND (sender_id=? OR receiver_id=?)').bind(id,userId,userId).first<Pick<DatabaseRows["messages"], "id">>();
  if(type!=='channel') return null;
  return db.prepare(`SELECT m.id FROM channel_messages m JOIN channels c ON c.id=m.channel_id WHERE m.id=? AND m.deleted_at IS NULL AND c.archived_at IS NULL AND
    (COALESCE(c.visibility,'company')='company' OR c.created_by=? OR EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id=c.id AND cm.user_id=?))`).bind(id,userId,userId).first<Pick<DatabaseRows["channel_messages"], "id">>();
}
export function downloadHeaders(filename:string,type:string) {
  const headers=new Headers({'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"});
  const safeInline=/^(image\/(png|jpeg|webp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/i.test(type);
  headers.set('Content-Disposition',`${safeInline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return headers;
}
