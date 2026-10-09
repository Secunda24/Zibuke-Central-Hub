import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest } from "next/server";
import { verifySession } from "@/src/modules/auth/session";

export async function documentContext(request: NextRequest, target?: string) {
  const session = await verifySession(request.cookies);
  if (!session) throw new Response("Unauthorized", { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const actor = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "id" | "role">>();
  if (!actor) throw new Response("Unauthorized", { status: 401 });
  const userId = target || actor.id;
  if (userId !== actor.id && actor.role !== "admin") throw new Response("Forbidden", { status: 403 });
  if (!await db.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first<Pick<DatabaseRows["users"], "id">>()) throw new Response("Employee not found", { status: 404 });
  return { db, bucket: env.EMPLOYEE_DOCUMENTS_BUCKET, actor, userId };
}

export async function validateDocument(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new Response("Choose a file up to 10 MB", { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const type = ascii(0,5) === "%PDF-" ? "application/pdf"
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
    : bytes[0] === 0x89 && ascii(1,4) === "PNG" && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 ? "image/png" : "";
  if (!type) throw new Response("Only PDF, JPEG and PNG documents are supported", { status: 400 });
  const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0,180) || "document";
  return { bytes, type, filename };
}

export function documentError(error: unknown) {
  return error instanceof Response ? error : Response.json({ error: "Document request failed. Please try again." }, { status: 500 });
}
