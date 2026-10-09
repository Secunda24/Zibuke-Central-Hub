import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateRow = { id: string; content: string; target_department: string; created_at: string; first_name: string; last_name: string };

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.userId;

  try {
    const user = await db.prepare('SELECT first_name, last_name, role, department FROM users WHERE id = ?')
      .bind(currentUserId).first<{ first_name: string; last_name: string; role: string; department: string }>();

    const isAdmin = String(user?.role || "").toLowerCase() === "admin";
    const select = `SELECT u.id, u.content, u.target_department, u.created_at, usr.first_name, usr.last_name
      FROM updates u JOIN users usr ON u.author_id = usr.id`;
    // Admins see every update; standard users only see updates to "All" or their own department.
    const { results: updates } = isAdmin
      ? await db.prepare(`${select} ORDER BY u.created_at DESC`).all<UpdateRow>()
      : await db.prepare(`${select} WHERE u.target_department = 'All' OR u.target_department = ? ORDER BY u.created_at DESC`)
          .bind(user?.department || "").all<UpdateRow>();

    return NextResponse.json({ user, updates });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserId = session.userId;

  try {
    const { content, target_department } = await request.json();
    if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

    const poster = await db.prepare("SELECT role FROM users WHERE id = ?").bind(currentUserId).first<{ role: string }>();
    const isAdmin = String(poster?.role || "").toLowerCase() === "admin";

    let target = "All";
    const requested = String(target_department || "").trim();
    if (requested && requested !== "All") {
      if (!isAdmin) return NextResponse.json({ error: "Only administrators can target a specific department." }, { status: 403 });
      target = requested.slice(0, 120);
    }

    const updateId = crypto.randomUUID();
    await db.prepare('INSERT INTO updates (id, author_id, content, target_department) VALUES (?, ?, ?, ?)')
      .bind(updateId, currentUserId, content.trim(), target).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to post update" }, { status: 500 });
  }
}
