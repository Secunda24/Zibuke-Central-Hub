import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!await verifySession(request.cookies)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { results } = await env.DB.prepare(`SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.department, u.job_title, u.appointed_manager, u.created_at, u.phone, i.status AS internship_status, i.started_at AS internship_started_at, i.qualified_at,
      EXISTS(SELECT 1 FROM employee_profiles p WHERE p.user_id=u.id AND length(trim(COALESCE(p.identity_number,'')))>0) AS identity_information_supplied,
      EXISTS(SELECT 1 FROM employee_documents d WHERE d.user_id=u.id AND d.kind='id') AS has_id_document,
      EXISTS(SELECT 1 FROM employee_id_verifications v WHERE v.user_id=u.id) AS id_verified
      FROM users u LEFT JOIN employee_internships i ON i.user_id=u.id WHERE u.archived_at IS NULL ORDER BY u.first_name ASC`).all<Pick<DatabaseRows["users"], "id" | "first_name" | "last_name" | "email" | "role" | "department" | "job_title" | "created_at" | "phone"> & {"identity_information_supplied":number;"has_id_document":number;"id_verified":number}>();
    return NextResponse.json({ people: results.map((u) => ({ ...u, identity_information_supplied: !!u.identity_information_supplied, has_id_document: !!u.has_id_document, id_verified: !!u.id_verified })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Failed to fetch directory" }, { status: 500 }); }
}
