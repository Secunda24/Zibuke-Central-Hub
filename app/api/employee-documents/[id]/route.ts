import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { NextRequest } from "next/server";
import { documentContext, documentError } from "@/src/modules/documents/server";
export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, bucket, actor } = await documentContext(request);
    const doc = await db.prepare("SELECT * FROM employee_documents WHERE id=?").bind((await params).id).first<Pick<DatabaseRows["employee_documents"], "id" | "user_id" | "kind" | "object_key" | "filename" | "content_type" | "size" | "uploaded_by" | "created_at">>();
    if (!doc || (doc.user_id !== actor.id && actor.role !== "admin")) return new Response("Not found", { status: 404 });
    const object = await bucket.get(doc.object_key);
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body as unknown as BodyInit, { headers: {
      "Content-Type": doc.content_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return documentError(error); }
}
