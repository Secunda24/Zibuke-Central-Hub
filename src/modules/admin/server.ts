import type { DatabaseRows } from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { isSuperAdmin } from "./superadmin";

// Server-only gate: resolves the session, then requires the account's email to be one
// of the hardcoded super-admin addresses. Throws a Response the caller can return as-is.
export async function requireSuperAdmin(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) throw new Response("Unauthorized", { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const actor = await db
    .prepare("SELECT id, email, role FROM users WHERE id = ?")
    .bind(session.userId)
    .first<Pick<DatabaseRows["users"], "id" | "email" | "role">>();
  if (!actor || !isSuperAdmin(actor.email)) throw new Response("Forbidden", { status: 403 });
  return { db, bucket: env.POPI_DOCUMENTS_BUCKET, actor };
}

export function adminError(error: unknown, message = "Request failed. Please try again.") {
  return error instanceof Response ? error : Response.json({ error: message }, { status: 500 });
}
