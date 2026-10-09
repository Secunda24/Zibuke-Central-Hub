import * as XLSX from "xlsx";

// Parsing for the admin bulk import. Pure and dependency-light so it can be unit-exercised:
// CSV is parsed natively, XLSX through SheetJS. Columns are detected from the header row rather
// than hard-coded, because the workbooks place the same fields in different columns.

export type RosterCandidate = { name: string; email: string; department: string; jobTitle: string; manager: string; row: number };

export type ParsedRoster = {
  candidates: RosterCandidate[];
  skipped: { row: number; reason: string }[];
  headers: string[];
  sheetName: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeHeader = (value: unknown) => String(value ?? "").replace(/[\s_]+/g, " ").replace(/:\s*$/, "").trim().toLowerCase();
/** First address in a cell, lower-cased and space-stripped. */
const normalizeEmail = (value: unknown) => (String(value ?? "").split(/[\r\n;,]+/).map((part) => part.trim()).filter(Boolean)[0] || "").toLowerCase().replace(/\s/g, "");
const cleanName = (value: unknown) => String(value ?? "").replace(/^\(i\)\s*/i, "").replace(/\s+/g, " ").trim();
/** "Siphe Gumede - Group 1" -> "Siphe Gumede"; a bare "Group 2" -> "". */
const cleanManager = (value: unknown) => {
  const cleaned = String(value ?? "").replace(/\r?\n/g, " ").replace(/\s*-?\s*group\s*[\w-]*/i, " ").replace(/\s+/g, " ").trim();
  return /^group\b/i.test(cleaned) ? "" : cleaned;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; } else quoted = false;
      } else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (character !== "\r") field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function rowsFromFile(bytes: Uint8Array, filename: string): { rows: string[][]; sheetName: string } {
  if (filename.toLowerCase().endsWith(".csv")) {
    return { rows: parseCsv(new TextDecoder().decode(bytes)), sheetName: "(csv)" };
  }
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }).map((row) => (row || []).map((cell) => String(cell ?? "")));
  return { rows, sheetName };
}

/** Section banners carry the role in these workbooks, above the header row. */
const SECTION_TITLES: [RegExp, string][] = [
  [/signall?ing managers/i, "Signaling Manager"],
  [/signall?ing accounts executives/i, "Signaling Accounts Executive"],
  [/business developers/i, "Business Developer"],
  [/community relations managers/i, "Community Relations Manager"],
  [/content creators/i, "Content Creator"],
];

/** The nearest section banner above this row, so a workbook without a title column still gets one. */
function sectionTitleFor(rows: string[][], rowIndex: number): string {
  for (let index = rowIndex - 1; index >= 0; index -= 1) {
    const text = (rows[index] || []).join(" ");
    if (!/zibuke/i.test(text)) continue;
    for (const [pattern, title] of SECTION_TITLES) if (pattern.test(text)) return title;
  }
  return "";
}

/** Locates the header row and maps each field to a column index. */
function detectColumns(rows: string[][]): { headerRow: number; columns: Partial<Record<string, number>>; headers: string[] } {
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const labels = (rows[index] || []).map(normalizeHeader);
    const columns: Partial<Record<string, number>> = {};
    // Each field is resolved by scanning the whole row for its preferred label first. This matters
    // because these workbooks have BOTH "Email Address" (personal) and "Company Email" — resolving
    // left-to-right would bind identity to the personal address.
    const assign = (field: string, test: (label: string) => boolean) => {
      if (columns[field] !== undefined) return;
      const at = labels.findIndex(test);
      if (at >= 0) columns[field] = at;
    };
    assign("name", (label) => /^(full )?name( and| &)?( surname)?:?$/.test(label) || label === "name surname");
    assign("email", (label) => label === "company email");
    assign("email", (label) => /^(email|email address|e mail):?$/.test(label));
    assign("department", (label) => /^(division|department|team):?$/.test(label));
    assign("jobTitle", (label) => /^(job title|title|position|role):?$/.test(label));
    assign("manager", (label) => /^(signall?ing )?manager$/.test(label) || /^(appointed manager|reporting to)$/.test(label));
    if (columns.name !== undefined && columns.email !== undefined) return { headerRow: index, columns, headers: labels.filter(Boolean) };
  }
  throw new Error("Could not find a header row with a name and an email column. Expected headers such as \"Name & Surname\" and \"Company Email\".");
}

export function parseRoster(bytes: Uint8Array, filename: string): ParsedRoster {
  const { rows, sheetName } = rowsFromFile(bytes, filename);
  const { headerRow, columns, headers } = detectColumns(rows);
  const candidates: RosterCandidate[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const cell = (row: string[], key: string) => (columns[key] === undefined ? "" : String(row[columns[key] as number] ?? ""));

  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const name = cleanName(cell(row, "name"));
    const email = normalizeEmail(cell(row, "email"));
    if (!name && !email) continue;
    if (!name) { skipped.push({ row: index + 1, reason: "Missing name" }); continue; }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row: index + 1, reason: email ? `Invalid email "${email}"` : "Missing email" }); continue; }
    const manager = cleanManager(cell(row, "manager"));
    // A trailing "- Group N" in the manager cell is the only thing cleanManager removes, so a name
    // that arrives from the workbook's banner column is already usable here.
    candidates.push({
      name,
      email,
      department: String(cell(row, "department") ?? "").trim(),
      jobTitle: String(cell(row, "jobTitle") ?? "").trim() || sectionTitleFor(rows, index),
      manager,
      row: index + 1,
    });
  }
  return { candidates, skipped, headers, sheetName };
}
