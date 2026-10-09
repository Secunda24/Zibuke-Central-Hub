// Import new candidates from the Accountability Assessment workbook:
//  1. parse every sheet (headers are detected, not hard-coded),
//  2. insert new employees into D1 (skip if the company email already exists),
//  3. append the new logins + 24-character temporary passwords to Employee_Passwords_Master.xlsx.
//
// Run from the repository root:  node apps/angel-core/scripts/import-new-candidates.ts [--apply]
// Dry-run by default. Company emails are the identity key; rows without one are skipped.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const ROOT = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/apps/angel-core';
const WORKBOOK = 'C:/Users/angel/OneDrive/Desktop/Zibuke/Anja 26-09-2026/Accountability Assessment Candidates Breakdown (2).xlsx';
const MASTER = 'C:/Users/angel/OneDrive/Desktop/Zibuke/Employee_Passwords_Master.xlsx';
const SCRATCH = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/.employee-import';
const DB = 'zibuke-central-prod';
const apply = process.argv.includes('--apply');

type Candidate = { name: string; email: string; jobTitle: string; appointedManager: string; sheet: string; row: number };
type Credential = { name: string; email: string; password: string };
type ExistingUser = { id: string; email: string; first_name: string; last_name: string; role: string; department: string | null; job_title: string | null; appointed_manager: string | null };

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
const header = (value: ExcelJS.CellValue): string => cellText(value).replace(/\s+/g, ' ').replace(/:\s*$/, '').trim().toLowerCase();
const slug = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();
/** First address in a cell (cells sometimes hold several), lower-cased and space-stripped. */
const normalizeEmail = (value: string): string => (value.split(/[\r\n;,]+/).map((p) => p.trim()).filter(Boolean)[0] || '').toLowerCase().replace(/\s/g, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** "Sales Managers" -> "Sales Manager", "Business Developers Group 2" -> "Business Developer", etc. */
function titleFromSheet(sheetName: string): string {
  const base = sheetName.replace(/\s*group\s*\d+\s*$/i, '').trim();
  const map: Record<string, string> = {
    'sales managers': 'Sales Manager',
    'people & systems interns': 'People & Systems Intern',
    'signaling managers': 'Signaling Manager',
    'signaling accounts executives': 'Signaling Accounts Executive',
    'signaling accounts executives a': 'Signaling Accounts Executive',
    'business developers': 'Business Developer',
    'community relations managers': 'Community Relations Manager',
    'content creators': 'Content Creator',
  };
  return map[slug(base)] ?? base.replace(/s$/i, '');
}
// Management mapping: the sheet's role -> the Zibuke Central division (Department). These three
// values are the ones the People page tabs, the Calendar department filter and the Announcement
// audience picker all use, so the directory stays consistent across those pages.
const DIVISION_BY_TITLE: Record<string, string> = {
  // Zibuke OnCall
  'Sales Manager': 'Zibuke OnCall',
  'Sales Representative': 'Zibuke OnCall',
  // Zibuke Africa Sales
  'Signaling Manager': 'Zibuke Africa Sales',
  'Signaling Accounts Executive': 'Zibuke Africa Sales',
  'Business Developer': 'Zibuke Africa Sales',
  // Zibuke Africa Office
  'People & Systems Intern': 'Zibuke Africa Office',
  'Community Relations Manager': 'Zibuke Africa Office',
  'Software Developer': 'Zibuke Africa Office',
  'Content Creator': 'Zibuke Africa Office',
};
// The company email domain is authoritative for the two company domains; the sheet role then picks
// the division within Zibuke Africa (Sales vs Office), so all three divisions stay in use.
const departmentFor = (email: string, jobTitle: string): string => {
  const address = email.trim().toLowerCase();
  if (address.endsWith('@zibukeoncall.co.za')) return 'Zibuke OnCall';
  if (address.endsWith('@zibukeafrica.co.za')) return DIVISION_BY_TITLE[jobTitle] ?? 'Zibuke Africa Office';
  return DIVISION_BY_TITLE[jobTitle] ?? 'Zibuke OnCall';
};
// Administrator rights without changing the public job title. People & Systems Interns are admins,
// plus the named intern below; everyone else is a standard employee.
const ADMIN_EMAILS = new Set(['zimasasomtsewu@zibukeafrica.co.za']);
const roleFor = (email: string, jobTitle: string): 'admin' | 'employee' =>
  (jobTitle === 'People & Systems Intern' || ADMIN_EMAILS.has(email.trim().toLowerCase()) ? 'admin' : 'employee');

const isSignalingAccountsSheet = (sheetName: string): boolean => /^signaling accounts executives/i.test(sheetName.trim());
/** "Siphe Gumede \n- Group 1" -> "Siphe Gumede"; "Mamello Mohoboko- Group 2H" -> "Mamello Mohoboko"; a bare "Group 2" -> "". */
const cleanManager = (value: string): string => {
  const cleaned = value.replace(/\r?\n/g, ' ').replace(/\s*-?\s*group\s*[\w-]*/i, ' ').replace(/^\(I\)\s*/i, '').replace(/\s+/g, ' ').trim();
  return /^group\b/i.test(cleaned) ? '' : cleaned;
};

function wrangler(args: string[]): ExcelJS.CellValue[] | null {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', DB, '--remote', ...args, '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (args.includes('--file')) { if (result.status !== 0) throw new Error('D1 apply failed: ' + (result.stderr || result.stdout)); return null; }
  if (result.status !== 0) throw new Error('D1 query failed: ' + (result.stderr || result.stdout));
  const stdout = result.stdout || '';
  const text = stdout.slice(stdout.indexOf('['), stdout.lastIndexOf(']') + 1);
  return (JSON.parse(text) as { results: ExcelJS.CellValue[] }[])[0].results;
}

// ---------------------------------------------------------------- 1. parse the workbook

interface ColumnMap { name: number; surname: number; companyEmail: number; email: number }

function detectColumns(sheet: ExcelJS.Worksheet, headerRow: number): ColumnMap {
  const columns: ColumnMap = { name: 0, surname: 0, companyEmail: 0, email: 0 };
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const label = header(cell.value);
    if (!label) return;
    if (!columns.name && (label.includes('full name') || label.includes('name & surname') || label === 'name')) columns.name = col;
    if (!columns.surname && label.includes('surname')) columns.surname = col;
    if (!columns.companyEmail && label.includes('company email')) columns.companyEmail = col;
    if (!columns.email && label.includes('email') && !label.includes('company')) columns.email = col;
  });
  return columns;
}

async function parseWorkbook(file: string): Promise<{ candidates: Candidate[]; skipped: { sheet: string; row: number; reason: string }[]; terminated: { name: string; email: string; sheet: string; row: number }[]; sheets: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const candidates: Candidate[] = [];
  const skipped: { sheet: string; row: number; reason: string }[] = [];
  const terminated: { name: string; email: string; sheet: string; row: number }[] = [];
  const sheets: string[] = [];

  for (const sheet of workbook.worksheets) {
    sheets.push(sheet.name);
    const jobTitle = titleFromSheet(sheet.name);

    // Locate the header row: the first row (1..10) that names a name column and an email column.
    let headerRow = 0;
    let columns: ColumnMap = { name: 0, surname: 0, companyEmail: 0, email: 0 };
    for (let row = 1; row <= Math.min(10, sheet.rowCount); row++) {
      const found = detectColumns(sheet, row);
      if (found.name && (found.companyEmail || found.email)) { headerRow = row; columns = found; break; }
    }
    if (!headerRow) { skipped.push({ sheet: sheet.name, row: 0, reason: 'Could not find a header row' }); continue; }

    for (let row = headerRow + 1; row <= sheet.rowCount; row++) {
      const record = sheet.getRow(row);
      const parts = [cellText(record.getCell(columns.name).value), columns.surname ? cellText(record.getCell(columns.surname).value) : ''];
      const name = parts.join(' ').replace(/^\(I\)\s*/i, '').replace(/\s+/g, ' ').trim();
      const companyEmail = columns.companyEmail ? normalizeEmail(cellText(record.getCell(columns.companyEmail).value)) : '';

      // A name in red means the person no longer works here: never import them, and remove the
      // account if it already exists (handled in main()).
      const nameCells = [columns.name, columns.surname].filter(Boolean).map((col) => record.getCell(col));
      if (nameCells.some(cellIsRed)) {
        terminated.push({ name, email: companyEmail, sheet: sheet.name, row });
        skipped.push({ sheet: sheet.name, row, reason: 'Name formatted in red (no longer employed) — excluded' });
        continue;
      }
      if (!name) continue;
      if (!companyEmail || !EMAIL_RE.test(companyEmail)) { skipped.push({ sheet: sheet.name, row, reason: companyEmail ? `Invalid company email "${companyEmail}"` : 'Missing company email' }); continue; }

      // The "Signaling Accounts Executives" sheets name an appointed manager per group in column B.
      const appointedManager = isSignalingAccountsSheet(sheet.name) ? cleanManager(cellText(record.getCell(2).value)) : '';
      candidates.push({ name, email: companyEmail, jobTitle, appointedManager, sheet: sheet.name, row });
    }
  }
  return { candidates, skipped, terminated, sheets };
}

// ---------------------------------------------------------------- 2 + 3. main

const { candidates, skipped, terminated, sheets } = await parseWorkbook(WORKBOOK);
console.log(`Workbook: ${path.basename(WORKBOOK)}`);
console.log(`Sheets (${sheets.length}): ${sheets.join(' | ')}`);
console.log(`Candidate rows with a valid company email: ${candidates.length}`);

// De-duplicate within the workbook (first occurrence wins).
const byEmail = new Map<string, Candidate>();
for (const candidate of candidates) if (!byEmail.has(candidate.email)) byEmail.set(candidate.email, candidate);
console.log(`Unique company emails: ${byEmail.size}`);

const existingRows = wrangler(['--command', 'SELECT id, LOWER(email) AS email, first_name, last_name, role, department, job_title, appointed_manager FROM users']) as unknown as ExistingUser[];
const existing = new Set(existingRows.map((row) => row.email));
const usersByEmail = new Map(existingRows.map((row) => [row.email, row]));
const usersByName = new Map<string, ExistingUser>();
for (const row of existingRows) {
  if (row.role === 'admin') continue;
  const nameKey = `${row.first_name || ''} ${row.last_name || ''}`.replace(/\s+/g, ' ').trim().toLowerCase();
  if (nameKey && !usersByName.has(nameKey)) usersByName.set(nameKey, row);
}
console.log(`Existing users in database: ${existing.size}`);

const newCandidates: Candidate[] = [];
const existingMatches: { candidate: Candidate; user: ExistingUser }[] = [];
for (const candidate of byEmail.values()) {
  const user = usersByEmail.get(candidate.email);
  if (user) existingMatches.push({ candidate, user });
  else newCandidates.push(candidate);
}
const alreadyPresent = existingMatches.map((match) => match.candidate.email);

// Red rows whose accounts still exist must be removed — they no longer work here.
const removals = new Map<string, { id: string; email: string; name: string; matched: string }>();
for (const person of terminated) {
  const nameKey = person.name.replace(/\s+/g, ' ').trim().toLowerCase();
  const match = (person.email ? usersByEmail.get(person.email) : undefined) ?? usersByName.get(nameKey);
  if (match) removals.set(match.id, { id: match.id, email: match.email, name: person.name || `${match.first_name} ${match.last_name}`.trim(), matched: person.email && usersByEmail.has(person.email) ? 'company email' : 'full name' });
}
console.log(`\nNo longer employed (red) — accounts to remove: ${removals.size}`);
for (const removal of removals.values()) console.log(`  - ${removal.name} <${removal.email}> (matched by ${removal.matched})`);

// Existing accounts: reconcile division, title, appointed manager and role to the management mapping.
const updates: { id: string; description: string; sql: string }[] = [];
for (const { candidate, user } of existingMatches) {
  const division = departmentFor(candidate.email, candidate.jobTitle);
  const manager = candidate.appointedManager || '';
  const mappedRole = roleFor(candidate.email, candidate.jobTitle);
  const role = user.role === 'admin' && mappedRole !== 'admin' ? 'admin' : mappedRole; // never demote an existing admin
  const changes: string[] = [];
  if ((user.department || '') !== division) changes.push(`division ${user.department || '(none)'} → ${division}`);
  if ((user.job_title || '') !== candidate.jobTitle) changes.push(`title ${user.job_title || '(none)'} → ${candidate.jobTitle}`);
  if ((user.appointed_manager || '') !== manager) changes.push(`manager ${user.appointed_manager || '(none)'} → ${manager || '(none)'}`);
  if (user.role !== role) changes.push(`role ${user.role} → ${role}`);
  if (!changes.length) continue;
  updates.push({ id: user.id, description: `${candidate.name} <${candidate.email}>: ${changes.join('; ')}`, sql: `UPDATE users SET department=${quote(division)}, job_title=${quote(candidate.jobTitle)}, appointed_manager=${manager ? quote(manager) : 'NULL'}, role=${quote(role)}, updated_at=datetime('now') WHERE id=${quote(user.id)};` });
}
console.log(`\nExisting accounts to reconcile: ${updates.length}`);
for (const update of updates.slice(0, 40)) console.log(`  ~ ${update.description}`);
if (updates.length > 40) console.log(`  … and ${updates.length - 40} more`);

console.log(`\nNew employees to add: ${newCandidates.length}`);
for (const candidate of newCandidates) console.log(`  + ${candidate.name} <${candidate.email}> — ${candidate.jobTitle} (${candidate.sheet}!${candidate.row})`);
console.log(`Already in the database (skipped): ${alreadyPresent.length}`);
for (const email of alreadyPresent) console.log(`  = ${email}`);
console.log(`\nSkipped source rows: ${skipped.length}`);
for (const item of skipped.slice(0, 30)) console.log(`  - ${item.sheet}:${item.row} — ${item.reason}`);
if (skipped.length > 30) console.log(`  … and ${skipped.length - 30} more`);

if (!newCandidates.length && !removals.size && !updates.length) { console.log('\nNothing to change — no new hires, no terminated accounts and no mapping updates.'); process.exit(0); }

// Credentials (24-character base64url = 18 random bytes) + PBKDF2 hashes.
const iterations = 100000;
const credentials: Credential[] = [];
const statements: string[] = [];
// Remove terminated accounts (and any dependent rows) before inserting new employees.
const DEPENDENT_TABLES = ['internship_history', 'employee_internships', 'learning_assignments', 'learning_progress', 'learning_assessments', 'learning_candidates', 'learning_quiz_attempts', 'tracking_submissions', 'employee_profiles', 'employee_documents', 'employee_id_verifications', 'login_challenges', 'event_attendees', 'notifications'];
for (const id of removals.keys()) {
  for (const table of DEPENDENT_TABLES) statements.push(`DELETE FROM ${table} WHERE user_id=${quote(id)};`);
  statements.push(`DELETE FROM users WHERE id=${quote(id)};`);
}
// Reconcile existing accounts to the management mapping (division / title / appointed manager / role).
for (const update of updates) statements.push(update.sql);
for (const candidate of newCandidates) {
  const userId = crypto.randomUUID();
  const password = crypto.randomBytes(18).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
  const [firstName, ...rest] = candidate.name.split(' ');
  statements.push(
    `INSERT INTO users (id,email,first_name,last_name,role,department,job_title,appointed_manager,id_document_path,password_hash,password_salt,password_iterations) VALUES (${quote(userId)},${quote(candidate.email)},${quote(firstName)},${quote(rest.join(' '))},${quote(roleFor(candidate.email, candidate.jobTitle))},${quote(departmentFor(candidate.email, candidate.jobTitle))},${quote(candidate.jobTitle)},${candidate.appointedManager ? quote(candidate.appointedManager) : 'NULL'},'',${quote(hash)},${quote(salt)},${iterations}) ON CONFLICT(email) DO NOTHING;`
  );
  credentials.push({ name: candidate.name, email: candidate.email, password });
}

if (!apply) {
  console.log('\nDRY RUN — no database rows written and the master workbook was not modified. Re-run with --apply.');
  process.exit(0);
}

// 2. Insert into D1.
const sqlFile = path.join(SCRATCH, 'import-new-candidates.sql');
fs.writeFileSync(sqlFile, statements.join('\n'), { mode: 0o600 });
let applied = false, lastError = '';
for (let attempt = 1; attempt <= 5 && !applied; attempt++) {
  try { wrangler(['--file', sqlFile]); applied = true; }
  catch (error) { lastError = error instanceof Error ? error.message : String(error); await new Promise((resolve) => setTimeout(resolve, 4000)); }
}
fs.rmSync(sqlFile, { force: true });
if (!applied) throw new Error('Could not insert new employees: ' + lastError);
console.log(`\nRemoved ${removals.size} terminated account(s), reconciled ${updates.length} existing account(s) and inserted ${credentials.length} new employee(s) into ${DB}.`);

// 3. Append to Employee_Passwords_Master.xlsx without touching the existing rows.
const master = new ExcelJS.Workbook();
await master.xlsx.readFile(MASTER);
const sheet = master.getWorksheet('Passwords') ?? master.addWorksheet('Passwords');
if (sheet.rowCount === 0) { sheet.addRow(['Name', 'Email', 'Temporary password']); sheet.getRow(1).font = { bold: true }; }
const knownEmails = new Set<string>();
sheet.eachRow((row, index) => { if (index > 1) knownEmails.add(normalizeEmail(cellText(row.getCell(2).value))); });
let appended = 0;
for (const credential of credentials) {
  if (knownEmails.has(normalizeEmail(credential.email))) continue;
  sheet.addRow([credential.name, credential.email, credential.password]);
  knownEmails.add(normalizeEmail(credential.email));
  appended += 1;
}
await master.xlsx.writeFile(MASTER);
console.log(`Appended ${appended} rows to ${path.basename(MASTER)} (now ${sheet.rowCount - 1} accounts).`);
console.log('\nNew temporary passwords:');
for (const credential of credentials) console.log(`  ${credential.name} <${credential.email}> : ${credential.password}`);
