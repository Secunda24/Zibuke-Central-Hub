// Import the "New Zibuke Candidates" workbook: a single sheet holding two stacked sections
// (Zibuke Africa - Signalling Managers, then Zibuke Africa - Signalling Accounts Executives).
//
//   node apps/angel-core/scripts/import-zibuke-candidates.ts           # dry run (default)
//   node apps/angel-core/scripts/import-zibuke-candidates.ts --apply   # write to D1 + master file
//   node apps/angel-core/scripts/import-zibuke-candidates.ts --dump    # print raw rows/columns
//
// Company email is the identity key (users.email is UNIQUE). Rows without a valid company email,
// blank rows, header rows and red-font (terminated) rows are skipped and reported.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const ROOT = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/apps/angel-core';
// Any workbook with the same stacked-section layout can be passed with --file=<path>; the default is
// the original candidates workbook.
const fileArg = process.argv.find((value) => value.startsWith('--file='))?.slice('--file='.length);
const WORKBOOK = fileArg || 'C:/Users/angel/OneDrive/Desktop/Zibuke/Anja 26-09-2026/New Zibuke Candidates.xlsx';
const MASTER = 'C:/Users/angel/OneDrive/Desktop/Zibuke/Employee_Passwords_Master.xlsx';
const SCRATCH = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/.employee-import';
const DB = 'zibuke-central-prod';
const SHEET = 'Sheet1';
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dump = args.has('--dump');
// Rows to leave out, e.g. someone already in the database under a differently-spelled address.
const skipEmails = new Set(process.argv.filter((value) => value.startsWith('--skip=')).map((value) => value.slice('--skip='.length).trim().toLowerCase()));

type Section = 'manager' | 'executive' | 'businessDeveloper';
type Candidate = { name: string; email: string; jobTitle: string; appointedManager: string; department: string; section: Section; row: number };
type Credential = { name: string; email: string; password: string };
type ExistingUser = { id: string; email: string; first_name: string | null; last_name: string | null; role: string; department: string | null; job_title: string | null; appointed_manager: string | null };

// Column layout, 1-based for ExcelJS (the brief's indices are 0-based). Verified against the real
// workbook with --dump:
//   Managers         : D(4) first name, E(5) surname, J(10) company email
//   Executives       : B(2) appointed manager, C(3) name, G(7) company email
//   Business Devs G2 : B(2) name, F(6) company email   (a third section the brief did not mention)
const COLUMNS = {
  manager: { first: 4, surname: 5, email: 10 },
  executive: { manager: 2, name: 3, email: 7 },
  businessDeveloper: { name: 2, email: 6 },
} as const;

// ---------------------------------------------------------------- helpers

const quote = (value: string): string => `'${String(value).replace(/'/g, "''")}'`;
const cellText = (value: ExcelJS.CellValue): string => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const anyValue = value as { text?: string; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (typeof anyValue.text === 'string') return anyValue.text;
    if (Array.isArray(anyValue.richText)) return anyValue.richText.map((part) => part.text).join('');
    if (anyValue.result != null) return String(anyValue.result);
    if (anyValue.hyperlink) return anyValue.hyperlink;
    return '';
  }
  return String(value);
};
const flatCell = (value: ExcelJS.CellValue): string => cellText(value).replace(/\s+/g, ' ').trim();
/** First address in a cell (cells sometimes hold several), lower-cased and space-stripped. */
const normalizeEmail = (value: string): string => (value.split(/[\r\n;,]+/).map((part) => part.trim()).filter(Boolean)[0] || '').toLowerCase().replace(/\s/g, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const singleName = (value: string): string => value.replace(/^\(I\)\s*/i, '').replace(/\s+/g, ' ').trim();

const RED_INDEXED = new Set([2, 10]);
function isRed(color: unknown): boolean {
  if (!color) return false;
  const value = color as { indexed?: number; argb?: string };
  if (typeof value.indexed === 'number' && RED_INDEXED.has(value.indexed)) return true;
  const argb = value.argb;
  if (!argb) return false;
  const hex = String(argb).length === 8 ? String(argb).slice(2) : String(argb);
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b].every(Number.isFinite) && r >= 0xb0 && g <= 0x60 && b <= 0x60;
}
const cellIsRed = (cell: ExcelJS.Cell): boolean => isRed(cell.font?.color);

/** "Siphe Gumede \n- Group 1" -> "Siphe Gumede"; "Mamello Mohoboko- Group 2H" -> "Mamello Mohoboko"; a bare "Group 2" -> "". */
const cleanManager = (value: string): string => {
  const cleaned = value.replace(/\r?\n/g, ' ').replace(/\s*-?\s*group\s*[\w-]*/i, ' ').replace(/^\(I\)\s*/i, '').replace(/\s+/g, ' ').trim();
  return /^group\b/i.test(cleaned) ? '' : cleaned;
};

const DIVISION_BY_TITLE: Record<string, string> = {
  'Signaling Manager': 'Zibuke Africa Sales',
  'Signaling Accounts Executive': 'Zibuke Africa Sales',
  'Business Developer': 'Zibuke Africa Sales',
};
const departmentFor = (email: string, jobTitle: string): string => {
  const address = email.trim().toLowerCase();
  if (address.endsWith('@zibukeoncall.co.za')) return 'Zibuke OnCall';
  if (address.endsWith('@zibukeafrica.co.za')) return DIVISION_BY_TITLE[jobTitle] ?? 'Zibuke Africa Sales';
  return DIVISION_BY_TITLE[jobTitle] ?? 'Zibuke OnCall';
};

function wrangler(wranglerArgs: string[]): ExcelJS.CellValue[] | null {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', DB, '--remote', ...wranglerArgs, '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (wranglerArgs.includes('--file')) { if (result.status !== 0) throw new Error('D1 apply failed: ' + (result.stderr || result.stdout)); return null; }
  if (result.status !== 0) throw new Error('D1 query failed: ' + (result.stderr || result.stdout));
  const stdout = result.stdout || '';
  const text = stdout.slice(stdout.indexOf('['), stdout.lastIndexOf(']') + 1);
  return (JSON.parse(text) as { results: ExcelJS.CellValue[] }[])[0].results;
}

const columnLetter = (index: number): string => { let value = index, letters = ''; while (value > 0) { const remainder = (value - 1) % 26; letters = String.fromCharCode(65 + remainder) + letters; value = Math.floor((value - 1) / 26); } return letters; };
const rowText = (row: ExcelJS.Row): string => {
  const parts: string[] = [];
  row.eachCell({ includeEmpty: false }, (cell) => { const text = flatCell(cell.value); if (text) parts.push(text); });
  return parts.join(' | ');
};
const rowNumbers = (row: ExcelJS.Row): number[] => { const numbers: number[] = []; row.eachCell({ includeEmpty: false }, (cell, col) => { if (flatCell(cell.value)) numbers.push(col); }); return numbers; };

// ---------------------------------------------------------------- parse

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(WORKBOOK);
const sheet = workbook.getWorksheet(SHEET) ?? workbook.worksheets[0];
if (!sheet) throw new Error(`No worksheet found in ${path.basename(WORKBOOK)}`);

if (dump) {
  console.log(`SHEETS: ${workbook.worksheets.map((item) => `${item.name} [rows=${item.rowCount} cols=${item.columnCount}]`).join(', ')}`);
  console.log(`--- ${sheet.name}: raw rows (col:value) ---`);
  for (let row = 1; row <= Math.min(sheet.rowCount, 140); row++) {
    const record = sheet.getRow(row);
    const cells: string[] = [];
    record.eachCell({ includeEmpty: false }, (cell, col) => cells.push(`${columnLetter(col)}:${flatCell(cell.value)}`));
    if (cells.length) console.log(`${row} >> ${cells.join(' | ')}`);
  }
  process.exit(0);
}

const candidates: Candidate[] = [];
const skipped: { row: number; reason: string }[] = [];
const terminated: { name: string; email: string; row: number }[] = [];
let section: Section | null = null;

for (let row = 1; row <= sheet.rowCount; row++) {
  const record = sheet.getRow(row);
  const text = rowText(record);
  if (!text) continue;
  const compact = text.toLowerCase().replace(/[^a-z]+/g, ' ');

  // Section banners switch the active cursor. "signall?ing" accepts both the British ("Signalling")
  // and American ("Signaling") spellings — the workbooks use each.
  if (/zibuke africa/.test(compact) && /business developers/.test(compact)) { section = 'businessDeveloper'; continue; }
  if (/zibuke africa/.test(compact) && /signall?ing managers/.test(compact)) { section = 'manager'; continue; }
  if (/zibuke africa/.test(compact) && /signall?ing accounts executives/.test(compact)) { section = 'executive'; continue; }
  if (!section) { skipped.push({ row, reason: 'Before any section banner' }); continue; }

  // Header / divider rows: the column labels, not data. Anchored with word boundaries because a
  // manager cell like "Group 4" next to the name "Nonjabulo" would otherwise spell "group no"
  // across the cell join and swallow a real candidate.
  if (/\bgroup no\b|\bcompany email\b|\borientation date\b|\bappointed manager\b/.test(compact) || /^manager:?$/.test(text.trim().toLowerCase())) {
    skipped.push({ row, reason: 'Header row' });
    continue;
  }

  if (section === 'manager') {
    const first = singleName(cellText(record.getCell(COLUMNS.manager.first).value));
    const surname = singleName(cellText(record.getCell(COLUMNS.manager.surname).value));
    const name = singleName(first === surname ? first : `${first} ${surname}`);
    const email = normalizeEmail(cellText(record.getCell(COLUMNS.manager.email).value));
    if (!name) continue;
    if ([COLUMNS.manager.first, COLUMNS.manager.surname].some((col) => cellIsRed(record.getCell(col)))) { terminated.push({ name, email, row }); skipped.push({ row, reason: 'Name in red (no longer employed)' }); continue; }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row, reason: email ? `Invalid company email "${email}"` : 'Missing company email' }); continue; }
    candidates.push({ name, email, jobTitle: 'Signaling Manager', appointedManager: '', department: departmentFor(email, 'Signaling Manager'), section, row });
  } else if (section === 'businessDeveloper') {
    const name = singleName(cellText(record.getCell(COLUMNS.businessDeveloper.name).value));
    const email = normalizeEmail(cellText(record.getCell(COLUMNS.businessDeveloper.email).value));
    if (!name) continue;
    if (cellIsRed(record.getCell(COLUMNS.businessDeveloper.name))) { terminated.push({ name, email, row }); skipped.push({ row, reason: 'Name in red (no longer employed)' }); continue; }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row, reason: email ? `Invalid company email "${email}"` : 'Missing company email' }); continue; }
    // Business Developers belong to Zibuke Africa Sales by decision, so their section banner
    // overrides the email-domain rule (their addresses are @zibukeoncall.co.za).
    candidates.push({ name, email, jobTitle: 'Business Developer', appointedManager: '', department: 'Zibuke Africa Sales', section, row });
  } else {
    const name = singleName(cellText(record.getCell(COLUMNS.executive.name).value));
    const email = normalizeEmail(cellText(record.getCell(COLUMNS.executive.email).value));
    const manager = cleanManager(cellText(record.getCell(COLUMNS.executive.manager).value));
    if (!name) continue;
    if (cellIsRed(record.getCell(COLUMNS.executive.name))) { terminated.push({ name, email, row }); skipped.push({ row, reason: 'Name in red (no longer employed)' }); continue; }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row, reason: email ? `Invalid company email "${email}"` : 'Missing company email' }); continue; }
    candidates.push({ name, email, jobTitle: 'Signaling Accounts Executive', appointedManager: manager, department: departmentFor(email, 'Signaling Accounts Executive'), section, row });
  }
}

const managerCount = candidates.filter((candidate) => candidate.section === 'manager').length;
const executiveCount = candidates.filter((candidate) => candidate.section === 'executive').length;
const developerCount = candidates.filter((candidate) => candidate.section === 'businessDeveloper').length;

console.log(`Workbook: ${path.basename(WORKBOOK)} (sheet "${sheet.name}", ${sheet.rowCount} rows)`);
console.log(`Parsed candidates: ${candidates.length} (signalling managers: ${managerCount}, accounts executives: ${executiveCount}, business developers: ${developerCount})`);

if (!candidates.length) {
  console.log('\nNo candidates parsed — the column layout probably differs from the brief. Raw rows:');
  for (let row = 1; row <= Math.min(sheet.rowCount, 25); row++) {
    const record = sheet.getRow(row);
    const cells: string[] = [];
    record.eachCell({ includeEmpty: false }, (cell, col) => cells.push(`${columnLetter(col)}:${flatCell(cell.value)}`));
    if (cells.length) console.log(`  ${row} >> ${cells.join(' | ')}`);
  }
  process.exit(1);
}

// De-duplicate within the workbook (first occurrence wins).
const byEmail = new Map<string, Candidate>();
for (const candidate of candidates) if (!byEmail.has(candidate.email)) byEmail.set(candidate.email, candidate);
for (const email of skipEmails) {
  if (byEmail.delete(email)) skipped.push({ row: 0, reason: `Excluded with --skip: ${email}` });
}
console.log(`Unique company emails: ${byEmail.size}`);

const existingRows = wrangler(['--command', 'SELECT id, LOWER(email) AS email, first_name, last_name, role, department, job_title, appointed_manager FROM users']) as unknown as ExistingUser[];
const usersByEmail = new Map(existingRows.map((row) => [row.email, row]));
console.log(`Existing users in database: ${existingRows.length}`);

const newCandidates: Candidate[] = [];
const existingMatches: { candidate: Candidate; user: ExistingUser }[] = [];
for (const candidate of byEmail.values()) {
  const user = usersByEmail.get(candidate.email);
  if (user) existingMatches.push({ candidate, user });
  else newCandidates.push(candidate);
}

const updates: { description: string; sql: string }[] = [];
for (const { candidate, user } of existingMatches) {
  const division = candidate.department;
  const manager = candidate.appointedManager || '';
  const changes: string[] = [];
  if ((user.department || '') !== division) changes.push(`division ${user.department || '(none)'} → ${division}`);
  if ((user.job_title || '') !== candidate.jobTitle) changes.push(`title ${user.job_title || '(none)'} → ${candidate.jobTitle}`);
  if (manager && (user.appointed_manager || '') !== manager) changes.push(`manager ${user.appointed_manager || '(none)'} → ${manager}`);
  if (!changes.length) continue;
  updates.push({
    description: `${candidate.name} <${candidate.email}>: ${changes.join('; ')}`,
    sql: `UPDATE users SET department=${quote(division)}, job_title=${quote(candidate.jobTitle)}, appointed_manager=${manager ? quote(manager) : 'NULL'}, updated_at=datetime('now') WHERE id=${quote(user.id)};`,
  });
}

console.log(`\nNew employees to add: ${newCandidates.length}`);
for (const candidate of newCandidates) {
  console.log(`  + ${candidate.name} <${candidate.email}> — ${candidate.jobTitle} → ${candidate.department}${candidate.appointedManager ? ` (manager: ${candidate.appointedManager})` : ''} [row ${candidate.row}]`);
}
console.log(`\nAlready in the database (mapping refreshed, password untouched): ${existingMatches.length}`);
for (const update of updates.slice(0, 30)) console.log(`  ~ ${update.description}`);
if (updates.length > 30) console.log(`  … and ${updates.length - 30} more`);

console.log(`\nSkipped source rows: ${skipped.length}`);
for (const item of skipped.slice(0, 30)) console.log(`  - row ${item.row} — ${item.reason}`);
if (skipped.length > 30) console.log(`  … and ${skipped.length - 30} more`);
if (terminated.length) console.log(`Red (terminated) rows: ${terminated.length} (never imported)`);

if (!newCandidates.length && !updates.length) { console.log('\nNothing to change.'); process.exit(0); }

// Credentials: 24-char base64url (18 random bytes) + the PBKDF2 format the login route verifies.
const iterations = 100000;
const credentials: Credential[] = [];
const statements: string[] = [];
for (const update of updates) statements.push(update.sql);
for (const candidate of newCandidates) {
  const userId = crypto.randomUUID();
  const password = crypto.randomBytes(18).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
  const [firstName, ...rest] = candidate.name.split(' ');
  statements.push(
    `INSERT INTO users (id,email,first_name,last_name,role,department,job_title,appointed_manager,id_document_path,password_hash,password_salt,password_iterations) VALUES (${quote(userId)},${quote(candidate.email)},${quote(firstName)},${quote(rest.join(' '))},'employee',${quote(candidate.department)},${quote(candidate.jobTitle)},${candidate.appointedManager ? quote(candidate.appointedManager) : 'NULL'},'',${quote(hash)},${quote(salt)},${iterations}) ON CONFLICT(email) DO NOTHING;`
  );
  credentials.push({ name: candidate.name, email: candidate.email, password });
}

if (!apply) {
  console.log(`\nDRY RUN — no database rows written and the master workbook was not modified. ${credentials.length} password(s) would be generated. Re-run with --apply.`);
  process.exit(0);
}

// Pre-flight: the master workbook must be writable BEFORE any D1 write. If it were locked (open in
// Excel) the accounts would be created with passwords that never got recorded — unrecoverable,
// because a re-run treats those emails as existing and skips them.
try { fs.closeSync(fs.openSync(MASTER, 'r+')); }
catch { throw new Error(`Cannot write ${MASTER}. Close it in Excel and re-run — no database changes were made.`); }

fs.mkdirSync(SCRATCH, { recursive: true });
// Crash-safe backup of the generated passwords, written before the database changes.
fs.writeFileSync(path.join(SCRATCH, 'import-zibuke-candidates-credentials.json'), JSON.stringify(credentials, null, 2), { mode: 0o600 });

// 1. Write to D1.
const sqlFile = path.join(SCRATCH, 'import-zibuke-candidates.sql');
fs.writeFileSync(sqlFile, statements.join('\n'), { mode: 0o600 });
let applied = false, lastError = '';
for (let attempt = 1; attempt <= 5 && !applied; attempt++) {
  try { wrangler(['--file', sqlFile]); applied = true; }
  catch (error) { lastError = error instanceof Error ? error.message : String(error); await new Promise((resolve) => setTimeout(resolve, 4000)); }
}
fs.rmSync(sqlFile, { force: true });
if (!applied) throw new Error('Could not write employees: ' + lastError);
console.log(`\nReconciled ${updates.length} existing account(s) and inserted ${credentials.length} new employee(s) into ${DB}.`);

// 2. Append to Employee_Passwords_Master.xlsx without touching existing rows.
const master = new ExcelJS.Workbook();
await master.xlsx.readFile(MASTER);
const passwordSheet = master.getWorksheet('Passwords') ?? master.addWorksheet('Passwords');
if (passwordSheet.rowCount === 0) { passwordSheet.addRow(['Name', 'Email', 'Temporary password']); passwordSheet.getRow(1).font = { bold: true }; }
const knownEmails = new Set<string>();
passwordSheet.eachRow((row, index) => { if (index > 1) knownEmails.add(normalizeEmail(cellText(row.getCell(2).value))); });
let appended = 0;
for (const credential of credentials) {
  if (knownEmails.has(normalizeEmail(credential.email))) continue;
  passwordSheet.addRow([credential.name, credential.email, credential.password]);
  knownEmails.add(normalizeEmail(credential.email));
  appended += 1;
}
await master.xlsx.writeFile(MASTER);
console.log(`Appended ${appended} row(s) to ${path.basename(MASTER)} (now ${passwordSheet.rowCount - 1} accounts).`);
console.log('\nNew temporary passwords:');
for (const credential of credentials) console.log(`  ${credential.name} <${credential.email}> : ${credential.password}`);
