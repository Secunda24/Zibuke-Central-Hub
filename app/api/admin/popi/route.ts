import { NextRequest } from "next/server";
import { validateDocument } from "@/src/modules/documents/server";
import { adminError, requireSuperAdmin } from "@/src/modules/admin/server";

export const runtime = "nodejs";

type PopiDocument = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  employee_id: string | null;
  employee_name: string | null;
  employee_department: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { db } = await requireSuperAdmin(request);
    const { results } = await db
      .prepare(`
        SELECT d.id, d.filename, d.content_type, d.size, d.created_at, d.employee_id,
               COALESCE(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), u.email) AS employee_name,
               u.department AS employee_department
        FROM popi_documents d
        LEFT JOIN users u ON u.id = d.employee_id
        ORDER BY employee_name IS NULL, employee_name COLLATE NOCASE, d.created_at DESC, d.id DESC
      `)
      .all<PopiDocument>();
    return Response.json({ documents: results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminError(error, "Could not load the POPI vault.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, bucket, actor } = await requireSuperAdmin(request);
    const form = await request.formData();

    // Server-side enforcement: a document must belong to an active employee.
    const employeeId = String(form.get("employee_id") || "").trim();
    if (!employeeId) return Response.json({ error: "Select an employee for this document" }, { status: 400 });
    const employee = await db
      .prepare("SELECT id FROM users WHERE id = ? AND archived_at IS NULL")
      .bind(employeeId)
      .first<{ id: string }>();
    if (!employee) return Response.json({ error: "Choose an active employee" }, { status: 400 });

    const { bytes, type, filename } = await validateDocument(form.get("file"));
    const id = crypto.randomUUID();
    // Folder-like layout: popi/<employee>/<uuid>-<name>, so the bucket is browsable per employee.
    const objectKey = `popi/${employeeId}/${id}-${filename}`;
    const createdAt = new Date().toISOString();
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType: type } });
    try {
      await db
        .prepare(
          "INSERT INTO popi_documents (id,filename,content_type,size,object_key,uploaded_by,employee_id,created_at) VALUES (?,?,?,?,?,?,?,?)"
        )
        .bind(id, filename, type, bytes.length, objectKey, actor.id, employeeId, createdAt)
        .run();
    } catch (error) {
      await bucket.delete(objectKey);
      throw error;
    }
    return Response.json(
      {
        success: true,
        document: {
          id,
          filename,
          content_type: type,
          size: bytes.length,
          created_at: createdAt,
          employee_id: employeeId,
          employee_name: null,
          employee_department: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return adminError(error, "Could not store the POPI document.");
  }
}
