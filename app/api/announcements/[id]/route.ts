import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import {createAnnouncementNotifications} from "@/src/modules/announcements/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: {params:Promise<{id:string}>}) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const session = await verifySession(request.cookies);
  
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const resolvedParams = await context.params;
    const announcementId = resolvedParams?.id || request.nextUrl.pathname.split('/').pop();

    if (!announcementId) {
      return NextResponse.json({ error: "Missing announcement ID" }, { status: 400 });
    }

    // Fetch user role and the announcement to check permissions
    const user = await db.prepare("SELECT role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "role">>();
    const announcement = await db.prepare("SELECT author_id FROM announcements WHERE id = ?").bind(announcementId).first<Pick<DatabaseRows["announcements"], "author_id">>();

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    // Only allow admins or the original author to delete it
    if (user?.role !== "admin" && announcement.author_id !== session.userId) {
      return NextResponse.json({ error: "You can only delete your own announcements" }, { status: 403 });
    }

    // Permanently delete the announcement
    await db.prepare("DELETE FROM announcements WHERE id = ?").bind(announcementId).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcements DELETE error", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
export async function PATCH(request: NextRequest, context: {params: Promise<{id:string}>}) {
 const session=await verifySession(request.cookies);
 if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {env}=await getCloudflareContext({async:true});
 const db=env.DB;
 try {
  const user=await db.prepare("SELECT role FROM users WHERE id=?").bind(session.userId).first<Pick<DatabaseRows["users"], "role">>();
  if(user?.role!=="admin")return NextResponse.json({error:"Administrator access required"},{status:403});
  const {id}=await context.params;
  const row=await db.prepare("SELECT * FROM announcements WHERE id=?").bind(id).first<Pick<DatabaseRows["announcements"], "id" | "title" | "content" | "author_id" | "priority" | "created_at" | "category" | "status" | "audience_type" | "audience_value" | "scheduled_at" | "published_at" | "pinned" | "reactions_enabled" | "require_acknowledgement" | "archived_at" | "updated_at">>();
  if(!row)return NextResponse.json({error:"Announcement not found"},{status:404});
  const body=await request.json();
  if(Object.keys(body).some(k=>!["status","pinned"].includes(k)) ||
    (body.status!==undefined&&!["published","archived"].includes(body.status)) ||
    (body.pinned!==undefined&&typeof body.pinned!=="boolean") ||
    Object.keys(body).length===0)return NextResponse.json({error:"Invalid announcement update"},{status:400});
  await db.prepare("UPDATE announcements SET status=?,pinned=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
   .bind(body.status??row.status,body.pinned===undefined?row.pinned:Number(body.pinned),body.status??row.status,id).run();
  if(body.status==="published")await createAnnouncementNotifications(db,row,session.userId);
  return NextResponse.json({success:true});
 }catch(error){console.error("Announcement update failed",error);return NextResponse.json({error:"Could not update announcement"},{status:500});}
}
