import type { DatabaseRows } from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifySession } from "@/src/modules/auth/session";
import { parseRoster, type RosterCandidate } from "@/src/modules/admin/bulk-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITERATIONS = 100000;
const MAX_BYTES = 5 * 1024 * 1024;
const CHUNK = 40;
const DIVISION_BY_TITLE: Record<string, string> = {
  "Sales Manager": "Zibuke OnCall",
  "Sales Representative": "Zibuke OnCall",
  "Signaling Manager": "Zibuke Africa Sales",
  "Signaling Accounts Executive": "Zibuke Africa Sales",
  "Business Developer": "Zibuke Africa Sales",
  "People & Systems Intern": "Zibuke Africa Office",
  "Community Relations Manager": "Zibuke Africa Office",
  "Software Developer": "Zibuke Africa Office",
  "Content Creator": "Zibuke Africa Office",
};

/** Uses the file's own division when present, otherwise the established email-domain rule. */
function departmentFor(email: string, jobTitle: string, provided: string): string {
  if (provided) return provided;
  const address = email.toLowerCase();
  if (address.endsWith("@zibukeoncall.co.za")) return "Zibuke OnCall";
  if (address.endsWith("@zibukeafrica.co.za")) return DIVISION_BY_TITLE[jobTitle] ?? "Zibuke Africa Sales";
  return DIVISION_BY_TITLE[jobTitle] ?? "Zibuke OnCall";
}

type ExistingUser = { id: string; email: string; archived_at: string | null; department: string | null; job_title: string | null; appointed_manager: string | null };

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  try {
    const actor = await db.prepare("SELECT role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "role">>();
    if (actor?.role !== "admin") return NextResponse.json({ error: "Forbidden: admin access required." }, { status: 403 });

    const form = await request.formData();
    const dryRun = String(form.get("dryRun") || "") === "1";
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a CSV or XLSX file to import" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Choose a file up to 5 MB" }, { status: 400 });
    const filename = file.name || "roster";
    if (!/\.(csv|xlsx|xlsm|xls)$/i.test(filename)) return NextResponse.json({ error: "Only .csv or .xlsx files are supported" }, { status: 400 });

    const parsed = parseRoster(new Uint8Array(await file.arrayBuffer()), filename);
    if (!parsed.candidates.length) {
      return NextResponse.json({ error: `No rows with a name and a company email were found in "${parsed.sheetName}".` }, { status: 400 });
    }

    const { results: existingRows } = await db
      .prepare("SELECT id, LOWER(email) AS email, archived_at, department, job_title, appointed_manager FROM users")
      .all<ExistingUser>();
    const existing = new Map(existingRows.map((row) => [row.email, row]));

    const creates: { candidate: RosterCandidate; password: string }[] = [];
    const updates: { id: string; candidate: RosterCandidate }[] = [];
    const skipped = [...parsed.skipped];

    for (const candidate of parsed.candidates) {
      const match = existing.get(candidate.email);
      if (!match) { creates.push({ candidate, password: crypto.randomBytes(18).toString("base64url") }); continue; }
      if (match.archived_at) {
        skipped.push({ row: candidate.row, reason: `${candidate.email} belongs to an archived account — restore it instead` });
        continue;
      }
      const changed =
        (candidate.department && candidate.department !== (match.department || "")) ||
        (candidate.jobTitle && candidate.jobTitle !== (match.job_title || "")) ||
        (candidate.manager && candidate.manager !== (match.appointed_manager || ""));
      if (changed) updates.push({ id: match.id, candidate });
    }

    const summary = {
      parsed: parsed.candidates.length,
      creates: creates.length,
      updates: updates.length,
      skipped: skipped.length,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
    };
    if (dryRun) {
      return NextResponse.json(
        { ...summary, dryRun: true, preview: { creates: creates.map((item) => item.candidate.email), updates: updates.map((item) => item.candidate.email), skipped } },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const statements: D1PreparedStatement[] = [];
    for (const { id, candidate } of updates) {
      // Only ever refreshes mapping fields. Never touches password_*, documents or role, so an
      // existing account keeps its credentials and its uploaded IDs, and a spreadsheet can never
      // grant administrator access.
      statements.push(
        db
          .prepare(
            "UPDATE users SET department = COALESCE(NULLIF(?, ''), department), job_title = COALESCE(NULLIF(?, ''), job_title), appointed_manager = COALESCE(NULLIF(?, ''), appointed_manager), updated_at = datetime('now') WHERE id = ?"
          )
          .bind(departmentFor(candidate.email, candidate.jobTitle, candidate.department), candidate.jobTitle, candidate.manager, id)
      );
    }
    for (const { candidate, password } of creates) {
      const userId = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, "sha256").toString("hex");
      const [firstName, ...rest] = candidate.name.split(/\s+/);
      statements.push(
        db
          .prepare(
            "INSERT INTO users (id,email,first_name,last_name,role,department,job_title,appointed_manager,id_document_path,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?,?,?,?,'',?,?,?) ON CONFLICT(email) DO NOTHING"
          )
          .bind(
            userId,
            candidate.email,
            firstName,
            rest.join(" "),
            "employee",
            departmentFor(candidate.email, candidate.jobTitle, candidate.department),
            candidate.jobTitle || "Employee",
            candidate.manager || null,
            hash,
            salt,
            ITERATIONS
          )
      );
    }

    // Chunked: D1 rejects very large single batches.
    for (let index = 0; index < statements.length; index += CHUNK) {
      await db.batch(statements.slice(index, index + CHUNK));
    }

    return NextResponse.json(
      {
        success: true,
        count: creates.length,
        updated: updates.length,
        skipped,
        headers: parsed.headers,
        sheetName: parsed.sheetName,
        credentials: creates.map(({ candidate, password }) => ({ email: candidate.email, name: candidate.name, tempPassword: password })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Bulk import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bulk import failed" }, { status: 500 });
  }
}
