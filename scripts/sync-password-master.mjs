// Adds records to Employee_Passwords_Master.xlsx for active accounts that are missing from it.
// Those are accounts created through the web bulk importer, whose generated passwords were only
// displayed on screen. Their passwords are unrecoverable (only the PBKDF2 hash is stored), so a
// fresh temp password is minted for each and written to both D1 and the master.
//
//   node sync-password-master.mjs           # dry run
//   node sync-password-master.mjs --apply   # write to D1 + master

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';

const ROOT = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/apps/angel-core';
const MASTER = 'C:/Users/angel/OneDrive/Desktop/Zibuke/Employee_Passwords_Master.xlsx';
const SCRATCH = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/.employee-import';
const DB = 'zibuke-central-prod';
const ITERATIONS = 100000;
const apply = process.argv.includes('--apply');

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const normalize = (value) => String(value || '').trim().toLowerCase();

function wrangler(args) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', DB, '--remote', ...args, '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (args.includes('--file')) { if (result.status !== 0) throw new Error('D1 apply failed: ' + (result.stderr || result.stdout)); return null; }
  if (result.status !== 0) throw new Error('D1 query failed: ' + (result.stderr || result.stdout));
  const stdout = result.stdout || '';
  return JSON.parse(stdout.slice(stdout.indexOf('['), stdout.lastIndexOf(']') + 1))[0].results;
}

const master = new ExcelJS.Workbook();
await master.xlsx.readFile(MASTER);
const sheet = master.getWorksheet('Passwords');
const known = new Set();
sheet.eachRow((row, index) => { if (index > 1) known.add(normalize(row.getCell(2).value)); });
console.log(`Master: ${path.basename(MASTER)} — ${known.size} accounts`);

// Only accounts created recently AND with the employee role are candidates. This deliberately
// excludes the original admin accounts (founder@, anjageldenhuys@, jayjacobs@ and the other Office
// admins), which are absent from the master simply because the master only ever tracked imported
// employees — resetting their passwords would lock them out.
const users = wrangler(['--command', "SELECT id, lower(email) AS email, first_name, last_name, role, department FROM users WHERE archived_at IS NULL AND role = 'employee' AND created_at >= datetime('now', '-2 days') ORDER BY created_at"]);
const missing = users.filter((user) => !known.has(user.email));
console.log(`Active accounts missing from the master: ${missing.length}`);
for (const user of missing) console.log(`  + ${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()} <${user.email}> — ${user.role}, ${user.department}`);

if (!missing.length) { console.log('\nNothing to add.'); process.exit(0); }
if (!apply) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); process.exit(0); }

// Fail before touching D1 if the workbook is locked (open in Excel), so passwords can't be lost.
try { fs.closeSync(fs.openSync(MASTER, 'r+')); }
catch { throw new Error(`Cannot write ${MASTER}. Close it in Excel and re-run — no database changes were made.`); }

const statements = [];
const credentials = [];
for (const user of missing) {
  const password = crypto.randomBytes(18).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha256').toString('hex');
  statements.push(`UPDATE users SET password_hash=${quote(hash)}, password_salt=${quote(salt)}, password_iterations=${ITERATIONS}, password_updated_at=datetime('now') WHERE id=${quote(user.id)};`);
  credentials.push({ name: `${String(user.first_name || '').trim()} ${String(user.last_name || '').trim()}`.trim(), email: user.email, password });
}

fs.mkdirSync(SCRATCH, { recursive: true });
const sqlFile = path.join(SCRATCH, 'sync-password-master.sql');
fs.writeFileSync(sqlFile, statements.join('\n'), { mode: 0o600 });
fs.writeFileSync(path.join(SCRATCH, 'sync-password-master-credentials.json'), JSON.stringify(credentials, null, 2), { mode: 0o600 });
let applied = false, lastError = '';
for (let attempt = 1; attempt <= 5 && !applied; attempt++) {
  try { wrangler(['--file', sqlFile]); applied = true; }
  catch (error) { lastError = error instanceof Error ? error.message : String(error); await new Promise((resolve) => setTimeout(resolve, 4000)); }
}
fs.rmSync(sqlFile, { force: true });
if (!applied) throw new Error('Could not reset passwords: ' + lastError);

for (const credential of credentials) sheet.addRow([credential.name, credential.email, credential.password]);
await master.xlsx.writeFile(MASTER);
console.log(`\nReset ${credentials.length} password(s) and added them to the master (now ${sheet.rowCount - 1} accounts).`);
console.log('New temporary passwords:');
for (const credential of credentials) console.log(`  ${credential.email} : ${credential.password}`);
