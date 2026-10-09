import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { NextRequest } from "next/server";
import { documentContext, documentError, validateDocument } from "@/src/modules/documents/server";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { db, userId } = await documentContext(request, request.nextUrl.searchParams.get("userId") || undefined);
    const { results } = await db.prepare("SELECT id,kind,filename,size,created_at FROM employee_documents WHERE user_id = ? ORDER BY created_at DESC, id DESC").bind(userId).all<Pick<DatabaseRows["employee_documents"], "id" | "kind" | "filename" | "size" | "created_at">>();
    const verification = await db.prepare("SELECT verified_at FROM employee_id_verifications WHERE user_id = ?").bind(userId).first<Pick<DatabaseRows["employee_id_verifications"], "verified_at">>();
    return Response.json({ documents: results, verified: !!verification, verifiedAt: verification?.verified_at || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return documentError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const context = await documentContext(request, request.nextUrl.searchParams.get("userId") || undefined);
    const { db, bucket, userId, actor } = context;
    const form = await request.formData();
    const kind = form.get("kind");
    if (kind !== "id" && kind !== "other") return Response.json({ error: "Invalid document category" }, { status: 400 });
    const { bytes, type, filename } = await validateDocument(form.get("file"));
    const id = crypto.randomUUID(), key = `${userId}/${kind}/${id}`;
    await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
    try {
      const statements = [db.prepare("INSERT INTO employee_documents (id,user_id,kind,object_key,filename,content_type,size,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,userId,kind,key,filename,type,bytes.length,actor.id,new Date().toISOString())];
      if (kind === "id") statements.push(db.prepare("DELETE FROM employee_id_verifications WHERE user_id = ?").bind(userId));
      statements.push(db.prepare("INSERT INTO employee_document_audit (id,user_id,actor_id,action,document_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),userId,actor.id,"upload",id));
      await db.batch(statements);
    } catch (error) { await bucket.delete(key); throw error; }
    return Response.json({ success: true }, { status: 201 });
  } catch (error) { return documentError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const { db, userId, actor } = await documentContext(request, request.nextUrl.searchParams.get("userId") || undefined);
    if (actor.role !== "admin") return Response.json({ error: "Only admins can verify IDs" }, { status: 403 });
    const { verified, documentId } = await request.json();
    if (typeof verified !== "boolean" || (documentId !== null && typeof documentId !== "string")) return Response.json({ error: "Invalid verification" }, { status: 400 });
    if (verified) {
      // Bind verification to the latest uploaded ID; stale browser tabs cannot verify a replacement.
      const result = await db.prepare(`INSERT INTO employee_id_verifications (user_id,verified_by,verified_at,document_id)
        SELECT ?,?,?,? WHERE COALESCE((SELECT id FROM employee_documents WHERE user_id=? AND kind='id' ORDER BY created_at DESC,id DESC LIMIT 1),'')=COALESCE(?,'')
        ON CONFLICT(user_id) DO UPDATE SET verified_by=excluded.verified_by,verified_at=excluded.verified_at,document_id=excluded.document_id`)
        .bind(userId,actor.id,new Date().toISOString(),documentId,userId,documentId).run();
      if (!result.meta.changes) return Response.json({ error: "The ID changed. Refresh before verifying." }, { status: 409 });
    } else await db.prepare("DELETE FROM employee_id_verifications WHERE user_id=?").bind(userId).run();
    await db.prepare("INSERT INTO employee_document_audit (id,user_id,actor_id,action,document_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),userId,actor.id,verified?"verify":"unverify",documentId).run();
    return Response.json({ success: true });
  } catch (error) { return documentError(error); }
}
