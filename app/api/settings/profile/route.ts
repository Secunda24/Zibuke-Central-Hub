import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  try {
    const user = await db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role,
        u.department, u.job_title, u.date_of_birth, p.personal_email,
        p.alternate_phone, p.identity_number, p.gender, p.city, p.province, p.start_date
      FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id WHERE u.id = ?
    `).bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "first_name" | "last_name" | "email" | "phone" | "role" | "department" | "job_title" | "date_of_birth"> & Pick<DatabaseRows["employee_profiles"], "personal_email" | "alternate_phone" | "identity_number" | "gender" | "city" | "province" | "start_date">>();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  // Explicit allowlist: role, department, job title and login email stay administrator-managed.
  const fields = ["firstName", "lastName", "phone", "personalEmail", "alternatePhone", "identityNumber", "gender", "city", "province", "dateOfBirth"] as const;
  for (const field of fields) {
    if (typeof body[field] !== "string" || body[field].length > 254) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
    body[field] = body[field].trim();
  }
  if (!body.firstName || (body.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.personalEmail))) {
    return NextResponse.json({ error: "Enter a name and valid personal email" }, { status: 400 });
  }
  if (body.dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) || !Number.isFinite(Date.parse(body.dateOfBirth)) || new Date(body.dateOfBirth).toISOString().slice(0, 10) !== body.dateOfBirth || body.dateOfBirth > new Date().toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "Enter a valid birth date in the past" }, { status: 400 });
  }
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  try {
    const exists = await db.prepare("SELECT id FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "id">>();
    if (!exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    await db.batch([
      db.prepare("UPDATE users SET first_name = ?, last_name = ?, phone = ?, date_of_birth = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(body.firstName, body.lastName, body.phone || null, body.dateOfBirth || null, session.userId),
      db.prepare(`INSERT INTO employee_profiles (user_id, personal_email, alternate_phone, identity_number, gender, city, province)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
        personal_email=excluded.personal_email, alternate_phone=excluded.alternate_phone,
        identity_number=excluded.identity_number, gender=excluded.gender, city=excluded.city,
        province=excluded.province, updated_at=datetime('now')`)
        .bind(session.userId, body.personalEmail.toLowerCase() || null, body.alternatePhone || null, body.identityNumber || null, body.gender || null, body.city || null, body.province || null),
    ]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
