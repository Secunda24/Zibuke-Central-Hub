// Retries the objects the first pass missed: library files store a URL in file_path
// ("/api/storage/vault/..."), so the leading /api/storage/ must be stripped to get the R2 key.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = 'C:/Users/angel/OneDrive/Documentos/Playground/zibuke-main/apps/angel-core';
const DEST = 'C:/Users/angel/OneDrive/Desktop/Zibuke/backups/r2';
const WRANGLER = path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js');

const BUCKETS = ['zibuke-collaboration', 'zibuke-employee-documents', 'zibuke-avatars'];

const TARGETS = [
  { dir: 'library-files', key: 'vault/general/fcc2f64f-420b-4ab4-9078-7a4200bb9508-Zibuke_Central_User_Manual.pdf' },
  { dir: 'library-files', key: 'vault/general/3a7a7497-d48d-40a1-ae6f-dbebe02428d8-IMG-20190518-WA0007_021254.jpeg' },
  { dir: 'library-files', key: 'vault/zibuke_oncall/a4c4ec76-8e55-41fa-bdbd-5f8a109d0fe5-Zibuke_OnCall_-_Reach_Out_Guidelines_-_Sales_Representatives_-_Oct_2026.pdf' },
  { dir: 'chat-attachments', key: 'collaboration/6a3af7ad-fe64-4386-9abc-526c99abea9c/7209b183-fdb5-4209-a6f6-10c0757548bf-Connecting-Zibuke-Platform-Creation-Guidelines-1-.docx' },
];

function download(bucket, key, outFile) {
  const result = spawnSync(process.execPath, [WRANGLER, 'r2', 'object', 'get', `${bucket}/${key}`, `--file=${outFile}`, '--remote'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return result.status === 0 && fs.existsSync(outFile);
}

const safe = (value) => String(value || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);

for (const target of TARGETS) {
  const dir = path.join(DEST, target.dir);
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, safe(target.key.split('/').pop()));
  let done = null;
  for (const bucket of BUCKETS) if (download(bucket, target.key, outFile)) { done = bucket; break; }
  console.log(done ? `ok   ${done}/${target.key}` : `MISSING  ${target.key}`);
}
