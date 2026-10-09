import type { DatabaseRows } from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CrmMetric = Pick<DatabaseRows["crm_metrics"], "id" | "metric_type" | "metric_value" | "notes" | "logged_at">;

const display = (first: string | null, last: string | null) => `${first || ""} ${last || ""}`.replace(/\s+/g, " ").trim().toLowerCase();

// Reads one employee's entries. Access is limited to the employee themselves, an admin, or the
// manager that employee is actually assigned to — a manager must not be able to read arbitrary
// employees' metrics by guessing an id.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  try {
    const caller = await env.DB
      .prepare("SELECT role, first_name, last_name FROM users WHERE id = ?")
      .bind(session.userId)
      .first<{ role: string; first_name: string | null; last_name: string | null }>();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const employee = await env.DB
      .prepare("SELECT id, first_name, last_name, email, department, job_title, appointed_manager FROM users WHERE id = ?")
      .bind(id)
      .first<Pick<DatabaseRows["users"], "id" | "first_name" | "last_name" | "email" | "department" | "job_title" | "appointed_manager">>();
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const isSelf = id === session.userId;
    const isAdmin = caller.role === "admin";
    const managerName = display(caller.first_name, caller.last_name);
    const appointed = String(employee.appointed_manager || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!isSelf && !isAdmin && !(managerName && appointed === managerName)) {
      return NextResponse.json({ error: "Forbidden: this employee is not in your team." }, { status: 403 });
    }

    const { results } = await env.DB
      .prepare("SELECT id, metric_type, metric_value, notes, logged_at FROM crm_metrics WHERE employee_id = ? ORDER BY logged_at DESC, id DESC LIMIT 200")
      .bind(id)
      .all<CrmMetric>();

    return NextResponse.json(
      {
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          department: employee.department,
          job_title: employee.job_title,
        },
        entries: results,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("CRM team member GET failed", error);
    return NextResponse.json({ error: "Could not load that employee's metrics" }, { status: 500 });
  }
}
