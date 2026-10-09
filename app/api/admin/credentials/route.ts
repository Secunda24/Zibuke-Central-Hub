import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { adminError, requireSuperAdmin } from "@/src/modules/admin/server";

export const runtime = "nodejs";

// Must match the platform login verification exactly (PBKDF2-SHA256, 64-byte key, hex),
// otherwise the generated credentials could never authenticate.
const ITERATIONS = 100000;

export async function POST(request: NextRequest) {
  try {
    const { db } = await requireSuperAdmin(request);
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const division = String(body?.division || "").trim();
    const jobTitle = String(body?.jobTitle || "").trim();
    const password = String(body?.password || "");

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !division || !jobTitle)
      return Response.json({ error: "Enter a name, valid email, division and job title" }, { status: 400 });
    if (password.length < 16)
      return Response.json({ error: "Generate a password of at least 16 characters" }, { status: 400 });
    const existing = await db.prepare("SELECT id, archived_at FROM users WHERE lower(email) = ?").bind(email).first<{ id: string; archived_at: string | null }>();
    if (existing) return Response.json({ error: existing.archived_at ? "This email belongs to an archived account — restore it or use a different email." : "This email already has an account" }, { status: 409 });

    const userId = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, "sha256").toString("hex");
    const [firstName, ...lastNameParts] = name.split(/\s+/);

    await db
      .prepare(
        "INSERT INTO users (id,first_name,last_name,email,role,department,job_title,id_document_path,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?,?,?,'',?,?,?)"
      )
      .bind(userId, firstName, lastNameParts.join(" "), email, "employee", division, jobTitle, hash, salt, ITERATIONS)
      .run();

    return Response.json({ success: true, userId }, { status: 201 });
  } catch (error) {
    return adminError(error, "Could not create the employee account.");
  }
}
