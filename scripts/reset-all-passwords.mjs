import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
function query(args){const result=spawnSync(process.execPath,[cli,'d1','execute','zibuke-central-prod','--remote',...args,'--json'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});if(result.status!==0)throw Error('Cloudflare reset operation failed. No successful reset is being reported.');if(args.includes('--file'))return null;return JSON.parse(result.stdout);}
if(!process.argv.includes('--apply'))throw Error('This resets every account. Supply --apply and the password on standard input.');
if(JSON.parse(readFileSync(path.join(root,'wrangler.json'),'utf8')).vars.FIRST_LOGIN_OTP_ENABLED!=='true')throw Error('Deploy mandatory OTP before resetting passwords.');
const password=readFileSync(0,'utf8').trimEnd();
if(password.length<12)throw Error('A password of at least twelve characters is required.');
const users=query(['--command','SELECT id FROM users'])[0].results;
if(!users.length)throw Error('No accounts found.');
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const stamp=new Date().toISOString();
const resetSalts=[];
const statements=users.map(user=>{const salt=crypto.randomBytes(32).toString('hex');resetSalts.push(salt);const hash=crypto.pbkdf2Sync(password,salt,100000,64,'sha256').toString('hex');return `UPDATE users SET password_hash=${quote(hash)},password_salt=${quote(salt)},password_iterations=100000,password_updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),email_verified_at=NULL WHERE id=${quote(user.id)};`;});
statements.push('DELETE FROM login_challenges;');
const folder=mkdtempSync(path.join(tmpdir(),'zibuke-password-reset-'));const file=path.join(folder,'reset.sql');
try {writeFileSync(file,statements.join('\n'),{mode:0o600});query(['--file',file]);const verified=query(['--command',`SELECT count(*) AS reset_count FROM users WHERE password_salt IN (${resetSalts.map(quote).join(",")}) AND email_verified_at IS NULL`])[0].results[0].reset_count;if(verified!==users.length)throw Error('Reset count mismatch; inspect the database before retrying.');console.log(JSON.stringify({resetAccounts:verified,otpRequiredOnNextLogin:true,oldChallengesCleared:true,resetAt:stamp}));}
finally {unlinkSync(file);rmdirSync(folder);}
