import { NextRequest } from "next/server";
import { downloadHeaders } from "@/src/modules/backend/access";
import { adminError, requireSuperAdmin } from "@/src/modules/admin/server";

export const runtime = "nodejs";

type PopiObject = { filename: string; content_type: string; object_key: string };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, bucket } = await requireSuperAdmin(request);
    const { id } = await params;
    const document = await db
      .prepare("SELECT filename, content_type, object_key FROM popi_documents WHERE id = ?")
      .bind(id)
      .first<PopiObject>();
    if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
    const object = await bucket.get(document.object_key);
    if (!object) return Response.json({ error: "Document not found in storage" }, { status: 404 });
    return new Response(object.body as unknown as BodyInit, {
      headers: downloadHeaders(document.filename, document.content_type),
    });
  } catch (error) {
    return adminError(error, "Could not retrieve the POPI document.");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, bucket } = await requireSuperAdmin(request);
    const { id } = await params;
    const document = await db
      .prepare("SELECT object_key FROM popi_documents WHERE id = ?")
      .bind(id)
      .first<Pick<PopiObject, "object_key">>();
    if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
    await bucket.delete(document.object_key);
    await db.prepare("DELETE FROM popi_documents WHERE id = ?").bind(id).run();
    return Response.json({ success: true });
  } catch (error) {
    return adminError(error, "Could not remove the POPI document.");
  }
}
