import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/src/modules/auth/session";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Change from "edge" to "nodejs" to match your working OpenNext configuration
export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  try {
    // 1. Verify Authentication
    const session = await verifySession(await cookies());
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Securely bind the database using OpenNext's context method
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    if (!db) {
      return NextResponse.json({ error: "Database binding missing." }, { status: 500 });
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // 2. Enforce Admin RBAC
    const currentUser = (await db
      .prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.userId)
      .first<Pick<DatabaseRows["users"], "role">>()) as { role: string } | null;

    if (!currentUser || currentUser.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    // Prevent Admins from removing themselves
    if (session.userId === targetUserId) {
      return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
    }

    // 3. Archive rather than delete. A hard DELETE FROM users is rejected by the ~19 tables
    // that reference users(id) with no ON DELETE action (messages, files, authored
    // announcements, training records, internships...), which surfaced as a generic 500.
    // Archiving keeps every dependent record and is reversible in SQL.
    const result = await db
      .prepare("UPDATE users SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL")
      .bind(targetUserId)
      .run();

    if (result.meta.changes === 0) {
      return NextResponse.json({ error: "Employee not found or already archived." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Employee archived and removed from the directory." });

  } catch (error) {
    // Surface the real driver message (e.g. a SQLite constraint violation) in the server log
    // instead of only returning a generic 500.
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Failed to archive user ${targetUserId}:`, detail, error);
    return NextResponse.json(
      { error: "Internal server error during removal.", detail },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify Authentication
    const session = await verifySession(await cookies());
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Securely bind the database using OpenNext's context method
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    
    if (!db) {
      return NextResponse.json({ error: "Database binding missing." }, { status: 500 });
    }

    const targetUserId = (await params).id;

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // 2. Enforce Admin RBAC
    const currentUser = (await db
      .prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.userId)
      .first<Pick<DatabaseRows["users"], "role">>()) as { role: string } | null;

    if (!currentUser || currentUser.role.toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    // 3. Parse the update payload
    const body = await req.json();
    const { first_name, last_name, email, role, department, job_title, internship_status, internship_evidence } = body;

    // 4. Execute the update
    const result = await db
      .prepare(`
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, role = ?, department = ?, job_title = ?
        WHERE id = ?
      `)
      .bind(first_name, last_name, email, role.toLowerCase(), department, job_title, targetUserId)
      .run();

    if (result.meta.changes === 0) {
      return NextResponse.json({ error: "User not found or no changes made." }, { status: 404 });
    }

    // 5. Optional internship status change (administrator qualification).
    if (internship_status === "qualified" || internship_status === "active") {
      const internship = await db
        .prepare("SELECT status FROM employee_internships WHERE user_id = ?")
        .bind(targetUserId)
        .first<{ status: string }>();
      if (!internship) {
        return NextResponse.json({ error: "This user is not an intern." }, { status: 404 });
      }
      if (internship_status === "qualified") {
        if (internship.status === "qualified") {
          return NextResponse.json({ error: "This intern is already qualified." }, { status: 409 });
        }
        const evidence = String(internship_evidence || "").trim().slice(0, 4000) || "Marked qualified by administrator.";
        await db
          .prepare("UPDATE employee_internships SET status='qualified', qualified_at=datetime('now'), qualified_by=?, qualification_evidence=? WHERE user_id=? AND status='active'")
          .bind(session.userId, evidence, targetUserId)
          .run();
        return NextResponse.json({ success: true, message: "Intern marked as qualified." });
      }
      await db
        .prepare("UPDATE employee_internships SET status='active', qualified_at=NULL, qualified_by=NULL, qualification_evidence=NULL WHERE user_id=?")
        .bind(targetUserId)
        .run();
      return NextResponse.json({ success: true, message: "Intern status reset to active." });
    }

    return NextResponse.json({ success: true, message: "User successfully updated." });

  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Internal server error during update." },
      { status: 500 }
    );
  }
}