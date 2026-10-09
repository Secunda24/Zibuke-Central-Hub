import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  department: string;
  job_title: string | null;
  log_count: number;
  last_logged_at: string | null;
};

// The logged-in user's "team" = employees whose appointed_manager equals their full name.
// Name-based because appointed_manager is stored as a display string; see the plan notes.
export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  try {
    const me = await env.DB
      .prepare("SELECT first_name, last_name FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ first_name: string | null; last_name: string | null }>();
    const managerName = `${me?.first_name || ""} ${me?.last_name || ""}`.replace(/\s+/g, " ").trim();

    if (!managerName) return NextResponse.json({ managerName: "", team: [] }, { headers: { "Cache-Control": "no-store" } });

    const { results } = await env.DB
      .prepare(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.department, u.job_title,
               (SELECT COUNT(*) FROM crm_metrics m WHERE m.employee_id = u.id) AS log_count,
               (SELECT MAX(m.logged_at) FROM crm_metrics m WHERE m.employee_id = u.id) AS last_logged_at
        FROM users u
        WHERE u.archived_at IS NULL
          AND u.id != ?
          AND LOWER(TRIM(COALESCE(u.appointed_manager, ''))) = ?
        ORDER BY u.first_name COLLATE NOCASE, u.last_name COLLATE NOCASE
      `)
      .bind(session.userId, managerName.toLowerCase())
      .all<Omit<TeamMember, "log_count"> & { log_count: number }>();

    return NextResponse.json(
      { managerName, team: results.map((row) => ({ ...row, log_count: Number(row.log_count || 0) })) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("CRM team GET failed", error);
    return NextResponse.json({ error: "Could not load your team" }, { status: 500 });
  }
}
