import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export function configurationProblems(config, secrets) {
  const available = new Set(secrets.map((entry) => entry.name));
  const required = ['SESSION_SECRET', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'GROQ_API_KEY'];
  if (String(config.vars?.FIRST_LOGIN_OTP_ENABLED) === 'true') required.push('RESEND_API_KEY');
  const problems = required.filter((name) => !available.has(name)).map((name) => `Missing Worker secret: ${name}`);
  if (!config.d1_databases?.some((db) => db.binding === 'DB')) problems.push('Missing DB binding');
  for (const name of ['EMPLOYEE_DOCUMENTS_BUCKET', 'AVATARS_BUCKET', 'COLLAB_BUCKET']) {
    if (!config.r2_buckets?.some((bucket) => bucket.binding === name)) problems.push(`Missing R2 binding: ${name}`);
  }
  if (!/^wss:\/\//.test(config.vars?.NEXT_PUBLIC_LIVEKIT_URL || '')) problems.push('LiveKit URL must use wss://');
  return problems;
}

function wrangler(args, json = true) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', root)), ...args], {
    cwd: fileURLToPath(root), encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Cloudflare check failed (${args.slice(0, 3).join(' ')}). Check Wrangler authentication and account permissions.`);
  return json ? JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim()) : result.stdout;
}

export function schemaProblems(requirements, objects, columns) {
  const present = new Set(columns.map((row) => `${row.table_name}.${row.column_name}`));
  const problems = [];
  for (const [table, names] of Object.entries(requirements.tables)) {
    for (const name of names) if (!present.has(`${table}.${name}`)) problems.push(`Missing database column: ${table}.${name}`);
  }
  for (const name of requirements.triggers) {
    if (!objects.some((row) => row.type === 'trigger' && row.name === name)) problems.push(`Missing database trigger: ${name}`);
  }
  return problems;
}

export function preflight() {
  const config = JSON.parse(readFileSync(new URL('wrangler.json', root), 'utf8'));
  const requirements = JSON.parse(readFileSync(new URL('scripts/runtime-requirements.json', root), 'utf8'));
  const problems = configurationProblems(config, wrangler(['secret', 'list']));
  const db = config.d1_databases?.find((entry) => entry.binding === 'DB');
  if (db) {
    const query = (sql) => wrangler(['d1', 'execute', db.database_name, '--remote', '--command', sql, '--json'])[0].results;
    const tables = Object.keys(requirements.tables);
    const statements = tables.map((name) => { if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid table name in requirements'); return 'PRAGMA table_info(' + name + ')'; }).join(';');
    const resultSets = wrangler(['d1', 'execute', db.database_name, '--remote', '--command', statements, '--json']);
    const columns = resultSets.flatMap((result, index) => result.results.map((row) => ({ table_name: tables[index], column_name: row.name })));
    const objects = query("SELECT name,type FROM sqlite_master WHERE type IN ('table','trigger')");
    problems.push(...schemaProblems(requirements, objects, columns));
  }
  const buckets = wrangler(['r2', 'bucket', 'list'], false);
  const bucketNames = new Set([...buckets.matchAll(/^name:\s+(\S+)/gm)].map((match) => match[1]));
  for (const bucket of config.r2_buckets || []) {
    if (!bucketNames.has(bucket.bucket_name)) problems.push(`R2 bucket unavailable: ${bucket.bucket_name}`);
  }
  if (problems.length) throw new Error(`Deployment blocked:\n${problems.join('\n')}`);
  console.log(`Production preflight passed: required secrets, ${Object.keys(requirements.tables).length} table schemas, ${requirements.triggers.length} triggers and private R2 bucket bindings. Secret values and employee data were not read.`);
  console.log('Provider delivery and authenticated browser journeys must still be verified after deployment.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { preflight(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
