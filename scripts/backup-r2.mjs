// Downloads every R2 object this platform references, so the backup is complete.
// Keys are read from D1 (every stored file is recorded there); wrangler has no bulk-list command.
// Read-only against Cloudflare: nothing is modified or deleted.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/apps/angel-core';
const DEST = 'C:/Users/angel/OneDrive/Desktop/Zibuke/backups/r2';
const DB = 'zibuke-central-prod';
const WRANGLER = path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js');

const SOURCES = [
  { name: 'employee-id-documents', buckets: ['zibuke-employee-documents'], sql: 'SELECT object_key AS k, filename AS f FROM employee_documents' },
  { name: 'popi-documents', buckets: ['zibuke-popi-documents'], sql: 'SELECT object_key AS k, filename AS f FROM popi_documents' },
  { name: 'avatars', buckets: ['zibuke-avatars', 'zibuke-employee-documents', 'zibuke-collaboration'], sql: "SELECT avatar_url AS k, id AS f FROM users WHERE COALESCE(avatar_url,'') <> ''" },
  { name: 'library-files', buckets: ['zibuke-collaboration', 'zibuke-employee-documents', 'zibuke-avatars'], sql: 'SELECT file_path AS k, filename AS f FROM files' },
  { name: 'chat-attachments', buckets: ['zibuke-collaboration'], sql: 'SELECT storage_key AS k, filename AS f FROM message_attachments WHERE storage_key IS NOT NULL' },
  { name: 'announcement-files', buckets: ['zibuke-collaboration'], sql: 'SELECT storage_key AS k, filename AS f FROM announcement_attachments' },
  { name: 'training-media', buckets: ['zibuke-collaboration'], sql: 'SELECT storage_key AS k, filename AS f FROM learning_lesson_files' },
];

function query(sql) {
  const result = spawnSync(process.execPath, [WRANGLER, 'd1', 'execute', DB, '--remote', '--json', '--command', sql], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`D1 query failed: ${result.stderr || result.stdout}`);
  const stdout = result.stdout || '';
  return JSON.parse(stdout.slice(stdout.indexOf('['), stdout.lastIndexOf(']') + 1))[0].results;
}

function download(bucket, key, outFile) {
  const result = spawnSync(process.execPath, [WRANGLER, 'r2', 'object', 'get', `${bucket}/${key}`, `--file=${outFile}`, '--remote'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return result.status === 0 && fs.existsSync(outFile);
}

const safe = (value) => String(value || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
fs.mkdirSync(DEST, { recursive: true });

const manifest = [];
let ok = 0, failed = 0, bytes = 0;

for (const source of SOURCES) {
  const rows = query(source.sql);
  console.log(`\n${source.name}: ${rows.length} object(s)`);
  const dir = path.join(DEST, source.name);
  fs.mkdirSync(dir, { recursive: true });

  for (const row of rows) {
    const key = String(row.k || '').trim();
    if (!key) continue;
    const outFile = path.join(dir, `${safe(row.f)}__${safe(key).slice(-40)}`);
    let done = false;
    for (const bucket of source.buckets) {
      if (download(bucket, key, outFile)) { done = true; manifest.push({ source: source.name, bucket, key, file: path.basename(outFile), size: fs.statSync(outFile).size }); break; }
    }
    if (done) { ok += 1; bytes += fs.statSync(outFile).size; }
    else { failed += 1; console.log(`  MISSING  ${key}`); }
  }
  console.log(`  downloaded: ${rows.length - (rows.length - ok)} accumulated ok=${ok}`);
}

fs.writeFileSync(path.join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n=== RESULT ===`);
console.log(`downloaded: ${ok}`);
console.log(`not found : ${failed}`);
console.log(`total size: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`saved to  : ${DEST}`);
