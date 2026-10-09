import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { escapeLike, excerpt, rank, searchLibrary, websiteIndexedAt, type SearchResult } from "@/src/modules/search/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Row = Record<string, string | number | null>;
type DB = { prepare(sql: string): { bind(...values: (string | number | null)[]): { all(): Promise<{ results: Row[] }>; first(): Promise<Row | null> }; all(): Promise<{ results: Row[] }> } };
const str = (value: unknown) => String(value ?? "");
export async function GET(request: NextRequest) {
  try {
    const session = await verifySession(request.cookies);
    if (!session) return NextResponse.json({ error: "Please sign in to search." }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") || "").trim().slice(0,100);
    const source = params.get("source") || "all";
    if (!["all","platform","africa","oncall"].includes(source)) return NextResponse.json({ error: "Invalid search source" }, { status: 400 });
    if (q.length < 2) return NextResponse.json({ results: [], total: 0, hasMore: false });
    const page = Math.max(1, Math.min(30, Number.parseInt(params.get("page") || "1",10) || 1));
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as unknown as { DB: DB }).DB;
    const user = await db.prepare("SELECT id, role, department FROM users WHERE id = ?").bind(session.userId).first();
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 401 });
    const admin = str(user.role).toLowerCase() === "admin";
    const dept = str(user.department) || "General";
    const like = `%${escapeLike(q)}%`;
    const results = searchLibrary(q,admin);
    const unavailable: string[] = [];
    if (source === "all" || source === "platform") {
      // Column inspection supports both soft-delete variants without ever searching deleted text.
      async function live(table: "messages" | "channel_messages" | "posts", alias: string) {
        const schema = await db.prepare(`PRAGMA table_info(${table})`).all();
        if (!schema.results.length) throw new Error("Missing table");
        const columns = new Set(schema.results.map(row => str(row.name)));
        return [columns.has("deleted_at") ? `${alias}.deleted_at IS NULL` : "1=1", columns.has("is_deleted") ? `COALESCE(${alias}.is_deleted,0) = 0` : "1=1", `${alias}.content NOT IN ('[This message was deleted]', 'This message was deleted')`].join(" AND ");
      }
      const channelAccess = `(COALESCE(c.visibility,'company') = 'company' OR c.created_by = ? OR EXISTS (SELECT 1 FROM channel_members member WHERE member.channel_id = c.id AND member.user_id = ?))`;
      const channelBinds = [session.userId, session.userId];
      const tasks: { name: string; run: () => Promise<{ results: Row[] }>; map: (r: Row) => Omit<SearchResult,"source"|"score"> }[] = [
        { name:"People", run:()=>db.prepare(`SELECT id, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')) AS title, email, department FROM users WHERE archived_at IS NULL AND ((first_name || ' ' || COALESCE(last_name,'')) LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR department LIKE ? ESCAPE '!') ORDER BY first_name LIMIT 30`).bind(like,like,like).all(), map:r=>({id:str(r.id),type:"Person",title:str(r.title),excerpt:`${r.department || ''} - ${r.email || ''}`,href:"/dashboard/people"}) },
        { name:"Messages", run:async()=>db.prepare(`SELECT m.id,m.content,CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END AS person_id, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS title FROM messages m JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END WHERE (m.sender_id = ? OR m.receiver_id = ?) AND ${await live('messages','m')} AND m.content LIKE ? ESCAPE '!' ORDER BY m.created_at DESC LIMIT 30`).bind(session.userId,session.userId,session.userId,session.userId,like).all(), map:r=>({id:str(r.id),type:"Direct message",title:str(r.title)||"Conversation",excerpt:excerpt(str(r.content),q),href:`/dashboard/messages/${encodeURIComponent(str(r.person_id))}`}) },
        { name:"Channels", run:()=>db.prepare(`SELECT c.id,c.name,c.description FROM channels c WHERE c.archived_at IS NULL AND ${channelAccess} AND (c.name LIKE ? ESCAPE '!' OR c.description LIKE ? ESCAPE '!') ORDER BY c.name LIMIT 30`).bind(...channelBinds,like,like).all(), map:r=>({id:str(r.id),type:"Channel",title:`#${r.name}`,excerpt:excerpt(str(r.description),q),href:`/dashboard/channels/${encodeURIComponent(str(r.id))}`}) },
        { name:"Channel messages", run:async()=>db.prepare(`SELECT cm.id,cm.content,c.id AS channel_id,c.name FROM channel_messages cm JOIN channels c ON c.id = cm.channel_id WHERE c.archived_at IS NULL AND ${channelAccess} AND ${await live('channel_messages','cm')} AND cm.content LIKE ? ESCAPE '!' ORDER BY cm.created_at DESC LIMIT 30`).bind(...channelBinds,like).all(), map:r=>({id:str(r.id),type:"Channel message",title:`#${r.name}`,excerpt:excerpt(str(r.content),q),href:`/dashboard/channels/${encodeURIComponent(str(r.channel_id))}`}) },
        { name:"Announcements", run:()=>db.prepare(`SELECT a.id,a.title,a.content FROM announcements a WHERE (a.status IN ('published','archived') OR (a.status = 'scheduled' AND datetime(a.scheduled_at) <= datetime('now'))) AND (? = 1 OR a.audience_type = 'company' OR (a.audience_type = 'department' AND a.audience_value = ?) OR (a.audience_type = 'role' AND a.audience_value = ?)) AND (a.title LIKE ? ESCAPE '!' OR a.content LIKE ? ESCAPE '!' OR a.category LIKE ? ESCAPE '!') ORDER BY a.created_at DESC LIMIT 30`).bind(admin?1:0,dept,str(user.role),like,like,like).all(), map:r=>({id:str(r.id),type:"Announcement",title:str(r.title),excerpt:excerpt(str(r.content),q),href:`/dashboard/announcements?focus=${encodeURIComponent(str(r.id))}`}) },
        { name:"Files", run:()=>db.prepare(`SELECT f.id,f.filename,COALESCE(d.name,f.department) AS department FROM files f LEFT JOIN file_departments d ON d.id=f.department WHERE (f.department = 'General' OR f.department = ? OR ? = 'Executive' OR ? = 1) AND (f.filename LIKE ? ESCAPE '!' OR COALESCE(d.name,f.department) LIKE ? ESCAPE '!') ORDER BY f.created_at DESC LIMIT 30`).bind(dept,dept,admin?1:0,like,like).all(), map:r=>({id:str(r.id),type:"File",title:str(r.filename),excerpt:`${r.department} folder - open Files to view this document`,href:"/dashboard/files"}) },
        { name:"Calendar", run:()=>db.prepare(`SELECT e.id,e.title,e.description,e.start_time FROM events e WHERE e.cancelled_at IS NULL AND (? = 1 OR e.organizer_id = ? OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = ?) OR (e.event_type = 'event' AND e.channel_id IS NULL) OR EXISTS (SELECT 1 FROM channels c WHERE c.id = e.channel_id AND ${channelAccess})) AND (e.title LIKE ? ESCAPE '!' OR e.description LIKE ? ESCAPE '!') ORDER BY e.start_time DESC LIMIT 30`).bind(admin?1:0,session.userId,session.userId,...channelBinds,like,like).all(), map:r=>({id:str(r.id),type:"Calendar event",title:str(r.title),excerpt:excerpt(`${r.start_time} ${r.description||''}`,q),href:`/dashboard/calendar?meetingId=${encodeURIComponent(str(r.id))}`}) },
        { name:"Feed", run:async()=>db.prepare(`SELECT p.id,p.content FROM updates p WHERE 1=1 AND p.content LIKE ? ESCAPE '!' ORDER BY p.created_at DESC LIMIT 30`).bind(like).all(), map:r=>({id:str(r.id),type:"Feed post",title:"Company feed",excerpt:excerpt(str(r.content),q),href:"/dashboard"}) },
        { name:"Notifications", run:async()=>{
          const schema=await db.prepare("PRAGMA table_info(notifications)").all();const cols=new Set(schema.results.map(r=>str(r.name)));
          const text=cols.has('text')?'text':cols.has('content')?'content':cols.has('message')?'message':null;if(!text)throw new Error('Missing notification text');
          return db.prepare(`SELECT id,${text} AS content FROM notifications WHERE user_id = ? AND ${text} LIKE ? ESCAPE '!' ORDER BY created_at DESC LIMIT 30`).bind(session.userId,like).all();
        }, map:r=>({id:str(r.id),type:"Notification",title:"Your notification",excerpt:excerpt(str(r.content),q),href:"/dashboard/notifications"}) },
      ];
      const queried = await Promise.allSettled(tasks.map(task=>task.run()));
      queried.forEach((outcome,i)=>{
        if(outcome.status==='rejected'){unavailable.push(tasks[i].name);return;}
        for(const row of outcome.value.results){const item=tasks[i].map(row);results.push({...item,source:'platform',score:rank(item.title,item.excerpt,q)||1});}
      });
    }
    const filtered=results.filter(r=>source==='all'||r.source===source).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
    const start=(page-1)*20;
    return NextResponse.json({ results:filtered.slice(start,start+20),total:filtered.length,hasMore:start+20<filtered.length,page,unavailable,websiteIndexedAt },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({ error:"Search is temporarily unavailable. Please try again." },{status:503});
  }
}
