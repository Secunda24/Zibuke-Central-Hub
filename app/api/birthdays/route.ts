import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";

import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  try {
    const { results } = await db.prepare(`
      SELECT id, first_name || ' ' || last_name AS name, department, date_of_birth 
      FROM users 
      WHERE date_of_birth IS NOT NULL AND archived_at IS NULL
    `).all<Pick<DatabaseRows["users"], "id" | "department" | "date_of_birth"> & {"name":string}>();

    return NextResponse.json({ birthdays: results });
  } catch (error) {
    // Failsafe in case the column is still being added
    return NextResponse.json({error:'Failed to load birthdays'},{status:500});
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  try {
    const { date_of_birth } = await request.json();
    
    if (typeof date_of_birth!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)||!Number.isFinite(Date.parse(date_of_birth))||new Date(date_of_birth).toISOString().slice(0,10)!==date_of_birth||date_of_birth>new Date().toISOString().slice(0,10)) {
      return NextResponse.json({ error: "Date of birth is required" }, { status: 400 });
    }

    await db.prepare('UPDATE users SET date_of_birth = ? WHERE id = ?')
      .bind(date_of_birth, userId)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update birthday" }, { status: 500 });
  }
}
