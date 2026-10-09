import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {configurationProblems,schemaProblems} from '../scripts/cloudflare-preflight.mjs';
const config=JSON.parse(readFileSync(new URL('../wrangler.json',import.meta.url),'utf8'));
const requirements=JSON.parse(readFileSync(new URL('../scripts/runtime-requirements.json',import.meta.url),'utf8'));
test('release gate rejects missing session secret even with LiveKit configured',()=>{
 const secrets=['LIVEKIT_API_KEY','LIVEKIT_API_SECRET','GROQ_API_KEY','RESEND_API_KEY'].map(name=>({name}));
 assert.deepEqual(configurationProblems(config,secrets),['Missing Worker secret: SESSION_SECRET']);
 secrets.push({name:'SESSION_SECRET'});assert.deepEqual(configurationProblems(config,secrets),[]);
 assert.ok(configurationProblems({...config,vars:{...config.vars,FIRST_LOGIN_OTP_ENABLED:'true'}},secrets.filter(x=>x.name!=='RESEND_API_KEY')).includes('Missing Worker secret: RESEND_API_KEY'));
});
test('runtime requirements match the baseline and reject missing training guards',()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const objects=db.prepare("SELECT name,type FROM sqlite_master").all();const columns=[];
 for(const table of Object.keys(requirements.tables))for(const row of db.prepare('PRAGMA table_info('+table+')').all())columns.push({table_name:table,column_name:row.name});
 assert.deepEqual(schemaProblems(requirements,objects,columns),[]);
 assert.ok(schemaProblems(requirements,objects.filter(x=>x.name!=='assessment_prerequisites'),columns).includes('Missing database trigger: assessment_prerequisites'));
 assert.ok(schemaProblems(requirements,objects,columns.filter(x=>!(x.table_name==='users'&&x.column_name==='password_hash'))).includes('Missing database column: users.password_hash'));
});
