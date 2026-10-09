const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,role TEXT,email_verified_at TEXT,last_login_at TEXT); INSERT INTO users VALUES ('owner','owner@example.com','employee',NULL,NULL),('other','other@example.com','employee',NULL,NULL),('admin','admin@example.com','admin',NULL,NULL);");
  sql.exec(fs.readFileSync('migrations/006_documents_and_login_otp.sql','utf8'));
  const db = { prepare(query) { return { bind(...args) { return {
    first: async () => sql.prepare(query).get(...args) || null,
    all: async () => ({ results: sql.prepare(query).all(...args) }),
    run: async () => ({ meta: { changes: sql.prepare(query).run(...args).changes } }),
  }; } }; }, batch: async statements => { sql.exec('BEGIN'); try { const results=[]; for(const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; } catch(error) { sql.exec('ROLLBACK'); throw error; } } };
  const objects = new Map();
  const bucket = { put: async (key,value) => objects.set(key,value), get: async key => objects.has(key) ? {body:objects.get(key)} : null, delete: async key => objects.delete(key) };
  const env = { DB:db, EMPLOYEE_DOCUMENTS_BUCKET:bucket, RESEND_API_KEY:'test',OTP_EMAIL_FROM:'test@example.com',SESSION_SECRET:'test-secret' };
  let actor='owner', messages=[];
  function load(path, extra={}) {
    const output=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const exports={};
    vm.runInNewContext(output,{exports,Buffer,Response,Headers,File,FormData,Uint8Array,Date,crypto:crypto.webcrypto,process,console,require(name){
      if(extra[name]) return extra[name];
      if(name==='@opennextjs/cloudflare') return {getCloudflareContext:async()=>({env})};
      if(name==='@/src/modules/auth/session') return {verifySession:async()=>actor?{userId:actor}:null};
      if(name==='next/server') return {};
      if(name==='resend') return {Resend:class {emails={send:async message=>{messages.push(message);return {data:{id:'test'}}}}}};
      return require(name);
    }});
    return exports;
  }
  const helper=load('src/modules/documents/server.ts');
  const routes=load('app/api/employee-documents/route.ts',{'@/src/modules/documents/server':helper});
  const download=load('app/api/employee-documents/[id]/route.ts',{'@/src/modules/documents/server':helper});
  const otp=load('src/modules/auth/login-otp.ts');
  function request(target,body) {return {cookies:{},nextUrl:new URL(`https://example.com/api/employee-documents${target?'?userId='+target:''}`),formData:async()=>body,json:async()=>body};}
  async function upload(target,kind='id',content='%PDF-1.4\nfixture') {const form=new FormData();form.set('kind',kind);form.set('file',new File([content],'test.pdf',{type:'application/pdf'}));return routes.POST(request(target,form));}
  return {sql,db,env,objects,routes,download,otp,request,upload,messages,setActor:value=>actor=value};
}

test('documents enforce ownership and admin verification; replacement invalidates approval',async()=>{
  const c=setup();
  c.setActor(null);assert.equal((await c.routes.GET(c.request())).status,401);
  c.setActor('other');assert.equal((await c.upload('owner')).status,403);
  c.setActor('owner');assert.equal((await c.upload()).status,201);
  let listing=await (await c.routes.GET(c.request())).json();assert.equal(listing.documents.length,1);assert.equal(listing.verified,false);
  const id=listing.documents[0].id;
  assert.equal((await c.routes.PATCH(c.request(null,{verified:true,documentId:id}))).status,403);
  c.setActor('other');assert.equal((await c.download.GET(c.request(),{params:Promise.resolve({id})})).status,404);
  c.setActor('admin');assert.equal((await c.download.GET(c.request(),{params:Promise.resolve({id})})).status,200);
  assert.equal((await c.routes.PATCH(c.request('owner',{verified:true,documentId:id}))).status,200);
  c.setActor('owner');listing=await (await c.routes.GET(c.request())).json();assert.equal(listing.verified,true);
  assert.equal((await c.upload(null,'other')).status,201);listing=await (await c.routes.GET(c.request())).json();assert.equal(listing.verified,true);
  assert.equal((await c.upload()).status,201);listing=await (await c.routes.GET(c.request())).json();assert.equal(listing.verified,false);
  c.setActor('admin');assert.equal((await c.routes.PATCH(c.request('owner',{verified:true,documentId:id}))).status,409);
  assert.equal((await c.routes.PATCH(c.request('other',{verified:true,documentId:null}))).status,200);
  assert.equal((await c.upload('owner','id','<script>alert(1)</script>')).status,400);
  assert.equal(c.objects.size,3);
});

test('OTP requires a password-issued token, expires, limits attempts, and cannot be replayed',async()=>{
  const c=setup(),user={id:'owner',email:'owner@example.com'};
  const challenge=await c.otp.beginLoginOtp(c.db,c.env,user);assert.equal(challenge.status,200);
  const code=c.messages[0].text.match(/code is (\d{8})/)[1];
  assert.match(code,/^[0-9]{8}$/);
  assert.equal(await c.otp.consumeLoginOtp(c.db,challenge.token,'123456',c.env.SESSION_SECRET),null);
  const stored=c.sql.prepare('SELECT * FROM login_challenges').get();assert.notEqual(stored.code_hash,code);
  assert.equal((await c.otp.beginLoginOtp(c.db,c.env,user)).status,429);
  assert.equal(await c.otp.consumeLoginOtp(c.db,'a'.repeat(64),code,c.env.SESSION_SECRET),null);
  assert.equal(await c.otp.consumeLoginOtp(c.db,challenge.token,'00000000',c.env.SESSION_SECRET),null);
  assert.equal(await c.otp.consumeLoginOtp(c.db,challenge.token,code,c.env.SESSION_SECRET),'owner');
  assert.equal(await c.otp.consumeLoginOtp(c.db,challenge.token,code,c.env.SESSION_SECRET),null);
  assert(c.sql.prepare("SELECT email_verified_at FROM users WHERE id='owner'").get().email_verified_at);
  const d=setup();const fresh=await d.otp.beginLoginOtp(d.db,d.env,user);const freshCode=d.messages[0].text.match(/code is (\d{8})/)[1];
  for(let i=0;i<5;i++) assert.equal(await d.otp.consumeLoginOtp(d.db,fresh.token,'00000000',d.env.SESSION_SECRET),null);
  assert.equal(await d.otp.consumeLoginOtp(d.db,fresh.token,freshCode,d.env.SESSION_SECRET),null);
  d.sql.exec('UPDATE login_challenges SET sent_at=0, expires_at=0, attempts=0');
  assert.equal(await d.otp.consumeLoginOtp(d.db,fresh.token,freshCode,d.env.SESSION_SECRET),null);
  const next=await d.otp.beginLoginOtp(d.db,d.env,user);assert.equal(next.status,200);
  assert.equal(await d.otp.consumeLoginOtp(d.db,fresh.token,freshCode,d.env.SESSION_SECRET),null);
  assert.equal((await d.otp.beginLoginOtp(d.db,{...d.env,RESEND_API_KEY:''},user)).status,503);
});
