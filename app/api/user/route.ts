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
    const user = await db
      .prepare('SELECT id, first_name || \' \' || last_name AS name, department, role, email FROM users WHERE id = ?')
      .bind(userId)
      .first<Pick<DatabaseRows["users"], "id" | "department" | "role" | "email"> & {"name":string}>();

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}