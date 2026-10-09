// One-off: bulk-approve ID verification for employees listed in the candidates workbook.
// Verification in this schema = a row in employee_id_verifications (there is no boolean column;
// the app computes users.id_verified via EXISTS on this table).
// Excludes the "Business Developers Group 1" sheet. Matches by login email OR personal email.
// Usage: node scripts/bulk-approve-ids.mjs [--apply] [workbook.xlsx]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const root = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/apps/angel-core';
const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const dir = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/.employee-import';
const apply = process.argv.includes('--apply');
const workbookPath = process.argv.slice(2).find((a) => a.endsWith('.xlsx')) || 'C:/Users/angel/OneDrive/Desktop/Zibuke/Anja 26-09-2026/Accountability Assessment Candidates Breakdown (2).xlsx';
const EXCLUDED_SHEET = 'business developers group 1';

function wrangler(args) {
  const result = spawnSync(process.execPath, [cli, 'd1', 'execute', 'zibuke-central-prod', '--remote', ...args, '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (args.includes('--file')) { if (result.status !== 0) throw new Error('apply failed: ' + (result.stderr || result.stdout)); return null; }
  if (result.status !== 0) throw new Error('query failed: ' + (result.stderr || result.stdout));
  const text = (result.stdout || '').slice((result.stdout || '').indexOf('['), (result.stdout || '').lastIndexOf(']') + 1);
  return JSON.parse(text)[0].results;
}
const query = (sql) => wrangler(['--command', sql]);
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const normalize = (v) => String(v || '').trim().toLowerCase().replace(/\s/g, '').replace(/,$/, '');
const EMAIL = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/;

// 1. Extract emails from every sheet except the excluded one.
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);
const emails = new Set();
const sheetsUsed = [];
for (const worksheet of workbook.worksheets) {
  if (worksheet.name.trim().toLowerCase() === EXCLUDED_SHEET) continue;
  sheetsUsed.push(worksheet.name);
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      const value = cell.value;
      const text = value == null || value instanceof Date ? '' : typeof value === 'object' ? String(value.text ?? value.result ?? (Array.isArray(value.richText) ? value.richText.map((r) => r.text).join('') : '')) : String(value);
      const match = text.match(EMAIL);
      if (match) emails.add(normalize(match[0]));
    });
  });
}
console.log(`Workbook: ${path.basename(workbookPath)}`);
console.log(`Sheets included (${sheetsUsed.length}): ${sheetsUsed.join(' | ')}`);
console.log(`Excluded sheet: ${EXCLUDED_SHEET}`);
console.log(`Distinct emails extracted: ${emails.size}\n`);

// 2. Load users + personal emails and the acting administrator.
const people = query('SELECT u.id, LOWER(u.email) AS email, LOWER(p.personal_email) AS personal_email FROM users u LEFT JOIN employee_profiles p ON p.user_id = u.id');
const admins = query("SELECT id, email FROM users WHERE role='admin' ORDER BY email");
if (!admins.length) throw new Error('No administrator account found to record as verifier.');
const verifier = admins[0];

const lookup = new Map();
for (const person of people) {
  if (person.email) lookup.set(normalize(person.email), person.id);
  if (person.personal_email) lookup.set(normalize(person.personal_email), person.id);
}

const matched = new Map();
const skipped = [];
for (const email of emails) {
  const userId = lookup.get(email);
  if (userId) matched.set(email, userId); else skipped.push(email);
}
const userIds = [...new Set(matched.values())];
const already = userIds.length ? query(`SELECT COUNT(*) AS c FROM employee_id_verifications WHERE user_id IN (${userIds.map(q).join(',')})`)[0].c : 0;
console.log(`Matched to a database user: ${matched.size} emails -> ${userIds.length} unique accounts`);
console.log(`Acting verifier: ${verifier.email} (${verifier.id})`);
console.log(`Already verified: ${already}`);
console.log(`Skipped (not found in database): ${skipped.length}`);
for (const email of skipped) console.log(`  - ${email}`);

if (!apply) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0); }
if (!userIds.length) { console.log('\nNothing to approve.'); process.exit(0); }

// 3. Apply: INSERT OR IGNORE one verification row per matched user.
const rows = userIds.map((id) => `(${q(id)}, ${q(verifier.id)}, datetime('now'), NULL)`).join(', ');
const sqlFile = `${dir}/bulk-approve-ids.sql`;
fs.writeFileSync(sqlFile, `INSERT OR IGNORE INTO employee_id_verifications (user_id, verified_by, verified_at, document_id) VALUES ${rows};`, { mode: 0o600 });
let applied = false, lastError = '';
for (let attempt = 1; attempt <= 5 && !applied; attempt++) {
  try { wrangler(['--file', sqlFile]); applied = true; }
  catch (error) { lastError = error.message; await new Promise((res) => setTimeout(res, 4000)); }
}
fs.rmSync(sqlFile, { force: true });
if (!applied) throw new Error('approval failed: ' + lastError);

const verified = query(`SELECT COUNT(*) AS c FROM employee_id_verifications WHERE user_id IN (${userIds.map(q).join(',')})`)[0].c;
console.log(`\nMarked as ID-verified: ${verified} employees (of ${userIds.length} matched accounts; ${verified - already} newly added).`);
