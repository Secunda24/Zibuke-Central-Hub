import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appDirectory = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, 'types', 'cloudflare-env.d.ts'], {
  cwd: appDirectory,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
appendFileSync(new URL('../cloudflare-env.d.ts', import.meta.url), '\n// Keep Worker runtime declarations module-scoped to avoid replacing Next.js DOM types.\nexport type { Env, D1Database, D1PreparedStatement, R2Bucket };\n');
