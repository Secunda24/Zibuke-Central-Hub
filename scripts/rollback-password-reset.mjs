// One-time recovery of the explicitly requested 28 September password reset.
// Run only while the production Worker is in maintenance mode.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

if (!process.argv.includes('--apply')) throw new Error('Requires --apply and production maintenance mode.');
const config = fs.readFileSync(path.join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'), 'utf8');
const token = config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error('Cloudflare login required.');
const base = 'https://api.cloudflare.com/client/v4/accounts/59d043a264dc6132d6feb01884cf2533/d1/database/b30f2ba0-4216-49e6-b236-fa28d083bbd7';
async function api(route, body) {
  const response = await fetch(base + route, {method: body ? 'POST' : 'GET', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, ...(body ? {body: JSON.stringify(body)} : {})});
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare operation failed (${response.status}): ${JSON.stringify(data.errors)}`);
  return data.result;
}
async function query(sql) {return (await api('/query', {sql}))[0].results;}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zibuke-password-recovery-'));
const save = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value), {mode: 0o600});
const fields = 'id,password_hash,password_salt,password_iterations,password_updated_at,email_verified_at';
const before = await query(`SELECT ${fields} FROM users ORDER BY id`);
if (before.length !== 135 || before.some(row => row.password_updated_at !== '2026-09-28T20:33:50.453Z')) throw new Error('Account state changed; review before proceeding.');
save('current-credentials.json', before);
const current = await api('/time_travel/bookmark');
save('current-bookmark.json', current);
console.log('Recovery checkpoints saved privately to ' + directory);
let old;
let restored;
try {
  restored = await api('/time_travel/restore?bookmark=00000014-00000010-000050f4-f137afc765bac0c403f5740518269818', {});
  save('restore-result.json', restored);
  old = await query(`SELECT ${fields} FROM users ORDER BY id`);
  save('previous-credentials.json', old);
} finally {
  // Always put the complete current database back before changing credentials.
  const bookmark = restored?.previous_bookmark || current.bookmark;
  await api('/time_travel/restore?bookmark=' + encodeURIComponent(bookmark), {});
  console.log('Complete current database restored.');
}
if (!old || old.length !== before.length || old.some((row, index) => row.id !== before[index].id || row.password_updated_at === before[index].password_updated_at)) throw new Error('Historical credentials did not match the expected accounts.');
const currentUsers = await query(`SELECT ${fields} FROM users ORDER BY id`);
if (JSON.stringify(currentUsers) !== JSON.stringify(before)) throw new Error('Current database verification failed; credentials were not modified.');
const quote = value => value == null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";
const sql = old.map(row => `UPDATE users SET password_hash=${quote(row.password_hash)},password_salt=${quote(row.password_salt)},password_iterations=${quote(row.password_iterations)},email_verified_at=${quote(row.email_verified_at)},password_updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=${quote(row.id)} AND password_updated_at='2026-09-28T20:33:50.453Z';`).join('\n') + '\nDELETE FROM login_challenges;';
await query(sql);
const after = await query(`SELECT ${fields} FROM users ORDER BY id`);
const keys = ['id','password_hash','password_salt','password_iterations','email_verified_at'];
if (after.length !== old.length || after.some((row, index) => keys.some(key => row[key] !== old[index][key]))) throw new Error('Credential recovery verification failed.');
save('verification.json', {restoredAccounts: after.length, completedAt: new Date().toISOString(), previousPasswordsRestored: true});
console.log(JSON.stringify({restoredAccounts: after.length, previousPasswordsRestored: true, oldSessionsInvalidated: true}));
