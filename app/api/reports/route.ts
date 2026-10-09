import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";

import { verifySession } from "@/src/modules/auth/session";
import { courseProgressSql, courseState, type CourseProgress } from "@/src/modules/training/queries";
import { localDate } from "@/src/modules/training/domain";

// 1. Force Next.js to bypass the cache so your reports stay live
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  try {
    // Gather top-level metrics
    const totalUsers = await db.prepare('SELECT count(*) as count FROM users WHERE archived_at IS NULL').first<{"count":number}>();
    const totalFiles = await db.prepare('SELECT count(*) as count FROM files').first<{"count":number}>();
    const totalChannels = await db.prepare('SELECT count(*) as count FROM channels').first<{"count":number}>();
    const totalAnnouncements = await db.prepare('SELECT count(*) as count FROM announcements').first<{"count":number}>();
    const totalCrmLogs = await db.prepare('SELECT count(*) as count FROM crm_metrics').first<{"count":number}>();
    const managedTeams = await db.prepare("SELECT count(DISTINCT TRIM(appointed_manager)) as count FROM users WHERE appointed_manager IS NOT NULL AND TRIM(appointed_manager) <> '' AND archived_at IS NULL").first<{"count":number}>();

    // Gather breakdown by department
    const deptStats = await db.prepare(`
      SELECT department, count(*) as count 
      FROM users 
      WHERE archived_at IS NULL
      GROUP BY department 
      ORDER BY count DESC
    `).all<Pick<DatabaseRows["users"], "department"> & {"count":number}>();

    const actor = await db.prepare('SELECT role FROM users WHERE id=?').bind(session.userId).first<{role:string}>();
    let training = null;
    if (actor?.role === 'admin') {
      const recent = await db.prepare("SELECT id,title,description,status FROM learning_courses WHERE created_at >= datetime('now','-30 days') AND status != 'archived' ORDER BY created_at DESC,id DESC").all<{id:string;title:string;description:string;status:string}>();
      const assignments = await db.prepare(courseProgressSql).all<CourseProgress>();
      const outstanding = assignments.results.map(courseState).filter(course => course.learning_status !== 'Completed');
      training = {newCourses:recent.results.length,recentCourses:recent.results.slice(0,3),outstanding:outstanding.length,employees:new Set(outstanding.map(course=>course.user_id)).size,overdue:outstanding.filter(course=>course.due_date && course.due_date < localDate()).length};
    }
    return NextResponse.json({
      training,
      metrics: {
        users: totalUsers?.count || 0,
        files: totalFiles?.count || 0,
        channels: totalChannels?.count || 0,
        announcements: totalAnnouncements?.count || 0,
        crmLogs: totalCrmLogs?.count || 0,
        managedTeams: managedTeams?.count || 0
      },
      departments: deptStats.results
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error("Failed to generate system reports:", error);
    return NextResponse.json({ error: "Failed to generate system reports" }, { status: 500 });
  }
}
