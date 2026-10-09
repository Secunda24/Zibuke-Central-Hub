import type { DatabaseRows } from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CrmMetric = Pick<DatabaseRows["crm_metrics"], "id" | "metric_type" | "metric_value" | "notes" | "logged_at">;

// Free-form on purpose: head office will replace this field set, so it is validated here rather
// than constrained by a CHECK in the database.
const METRIC_TYPE = /^[a-z_]{2,40}$/;

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  try {
    const { results } = await env.DB
      .prepare("SELECT id, metric_type, metric_value, notes, logged_at FROM crm_metrics WHERE employee_id = ? ORDER BY logged_at DESC, id DESC LIMIT 100")
      .bind(session.userId)
      .all<CrmMetric>();
    return NextResponse.json({ entries: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("CRM metrics GET failed", error);
    return NextResponse.json({ error: "Could not load your metrics" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  try {
    const body = (await request.json().catch(() => null)) as { metricType?: unknown; metricValue?: unknown; notes?: unknown } | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const metricType = String(body.metricType ?? "").trim().toLowerCase();
    const metricValue = String(body.metricValue ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (!METRIC_TYPE.test(metricType)) return NextResponse.json({ error: "Choose a valid metric type" }, { status: 400 });
    if (!metricValue || metricValue.length > 100) return NextResponse.json({ error: "Enter a value of up to 100 characters" }, { status: 400 });
    if (notes.length > 2000) return NextResponse.json({ error: "Notes must be 2000 characters or fewer" }, { status: 400 });

    const id = crypto.randomUUID();
    const loggedAt = new Date().toISOString();
    await env.DB
      .prepare("INSERT INTO crm_metrics (id, employee_id, metric_type, metric_value, notes, logged_at) VALUES (?,?,?,?,?,?)")
      .bind(id, session.userId, metricType, metricValue, notes, loggedAt)
      .run();

    return NextResponse.json(
      { success: true, entry: { id, metric_type: metricType, metric_value: metricValue, notes, logged_at: loggedAt } },
      { status: 201 }
    );
  } catch (error) {
    console.error("CRM metrics POST failed", error);
    return NextResponse.json({ error: "Could not save your entry" }, { status: 500 });
  }
}
