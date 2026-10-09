import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { validateDocument, documentError } from "@/src/modules/documents/server";
import crypto from "node:crypto";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const session = await verifySession(req.cookies);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB, bucket = env.EMPLOYEE_DOCUMENTS_BUCKET;
    const currentUser = await db.prepare("SELECT role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "role">>();
    if (currentUser?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const form = await req.formData();
    if (form.get("action") !== "single_hire") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const name = String(form.get("name") || "").trim(), email = String(form.get("email") || "").trim().toLowerCase();
    const role = String(form.get("role") || "employee"), department = String(form.get("department") || ""), title = String(form.get("job_title") || "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["employee","admin"].includes(role) || !department || !title) return NextResponse.json({ error: "Enter valid employee details" }, { status: 400 });
    const existingAccount = await db.prepare("SELECT id, archived_at FROM users WHERE lower(email)=?").bind(email).first<Pick<DatabaseRows["users"], "id" | "archived_at">>();
    if (existingAccount) return NextResponse.json({ error: existingAccount.archived_at ? "This email belongs to an archived account — restore it or use a different email." : "This email already has an account" }, { status: 409 });
    const file = await validateDocument(form.get("idDocument"));
    const userId = crypto.randomUUID(), documentId = crypto.randomUUID(), key = `${userId}/id/${documentId}`;
    const tempPassword = crypto.randomBytes(18).toString("base64url"), salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(tempPassword, salt, 100000, 64, "sha256").toString("hex");
    const [first, ...last] = name.split(/\s+/);
    await bucket.put(key, file.bytes, { httpMetadata: { contentType: file.type } });
    try {
      await db.batch([
        db.prepare("INSERT INTO users (id,first_name,last_name,email,role,department,job_title,id_document_path,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?,?,?,'',?,?,100000)").bind(userId,first,last.join(" "),email,role,department,title,hash,salt),
        db.prepare("INSERT INTO employee_documents (id,user_id,kind,object_key,filename,content_type,size,uploaded_by,created_at) VALUES (?,?,'id',?,?,?,?,?,?)").bind(documentId,userId,key,file.filename,file.type,file.bytes.length,session.userId,new Date().toISOString()),
        db.prepare("INSERT INTO employee_document_audit (id,user_id,actor_id,action,document_id) VALUES (?,?,?,'upload',?)").bind(crypto.randomUUID(),userId,session.userId,documentId)
      ]);
    } catch (error) { await bucket.delete(key); throw error; }
    return NextResponse.json({ success: true, tempPassword, userId });
  } catch (error) { return documentError(error); }
}
