const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const {NextRequest}=require('next/server');

function setup(realSession=false){
 const sql=new DatabaseSync(':memory:'); sql.exec(fs.readFileSync('schema.sql','utf8'));
 const password='Disposable-test-password',salt='fixture-salt';
 const hash=crypto.pbkdf2Sync(password,salt,1000,64,'sha256').toString('hex');
 for(const role of ['admin','employee'])sql.prepare("INSERT INTO users(id,email,first_name,last_name,role,department,id_document_path,password_hash,password_salt,password_iterations,password_updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(role,role+'@example.test','Test',role,role,'Zibuke OnCall','',hash,salt,1000,'2020-01-01 00:00:00');
 const db={prepare(query){let args=[];const statement={bind(...values){args=values;return statement},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args),success:true}},async run(){return {success:true,meta:{changes:sql.prepare(query).run(...args).changes}}}};return statement},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
 const objects=new Map();const bucket={async get(key){return objects.get(key)||null},async put(key,value){objects.set(key,{body:value})},async delete(key){objects.delete(key)},async list(){return {objects:[]}}};
 const env={DB:db,SESSION_SECRET:'test-only-session-secret-of-at-least-32-characters',FIRST_LOGIN_OTP_ENABLED:'false',EMPLOYEE_DOCUMENTS_BUCKET:bucket,AVATARS_BUCKET:bucket,COLLAB_BUCKET:bucket};
 let actor='employee';const cache=new Map();
 function load(filename){filename=path.resolve(filename);if(cache.has(filename))return cache.get(filename);const exports={};cache.set(filename,exports);
  const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(output,{exports,module:{exports},Buffer,Response,Request,Headers,URL,File,FormData,TextEncoder,TextDecoder,Uint8Array,Date,Map,Set,AbortController,setTimeout,clearTimeout,crypto:crypto.webcrypto,process,console,require(name){
   if(name==='@opennextjs/cloudflare')return {getCloudflareContext:()=>({env})};
   if(name==='@/src/modules/auth/session'&&!realSession)return {verifySession:async()=>actor?{userId:actor}:null};
   if(name.startsWith('@/')||name.startsWith('.')){let target=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(filename),name);if(target.endsWith('.json'))return JSON.parse(fs.readFileSync(target,'utf8'));if(!path.extname(target))target+='.ts';return load(target)}
   return require(name);
  }},{filename});return exports;
 }
 function request(url,options={}){return new NextRequest('https://example.test'+url,options)}
 return {sql,env,load,request,password,setActor(value){actor=value}};
}

const listingRoutes=['user','dashboard','feed','people','birthdays','files','announcements','calendar','channels','messages','notifications','notifications/latest','reports','reports/training','reports/tracking','settings/profile','employee-documents','training','training/summary','backend/health','search?q=test','calls/signal'];
test('all main API reads execute against the full schema for employee and admin',async()=>{
 const c=setup();for(const actor of ['employee','admin']){c.setActor(actor);for(const url of listingRoutes){const route=c.load('app/api/'+url.split('?')[0]+'/route.ts');const response=await route.GET(c.request('/api/'+url));const body=await response.text();assert.ok(response.status<500,`${actor} ${url}: ${response.status} ${body}`);if(!['reports/training','search?q=test'].includes(url))assert.equal(response.status,200,`${actor} ${url}: ${body}`)}}
});
test('API listing routes reject anonymous access',async()=>{
 const c=setup();c.setActor(null);for(const url of listingRoutes){const route=c.load('app/api/'+url.split('?')[0]+'/route.ts');const response=await route.GET(c.request('/api/'+url));assert.equal(response.status,401,url)}
});
test('real password login issues a verifiable session and password changes revoke it',async()=>{
 const c=setup(true);const login=c.load('app/api/auth/login/route.ts');
 const wrong=await login.POST(c.request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'employee@example.test',password:'wrong'})}));assert.equal(wrong.status,401);
 const response=await login.POST(c.request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'employee@example.test',password:c.password})}));assert.equal(response.status,200,await response.clone().text());
 const cookie=response.cookies.get('zc_session');assert.ok(cookie?.value);
 const session=c.load('src/modules/auth/session.ts');const source={get:()=>cookie};assert.equal((await session.verifySession(source)).userId,'employee');
 c.sql.prepare("UPDATE users SET password_updated_at='2099-01-01 00:00:00' WHERE id='employee'").run();assert.equal(await session.verifySession(source),null);
});
test('missing session configuration fails closed without crashing session reads',async()=>{
 const c=setup(true);delete c.env.SESSION_SECRET;const session=c.load('src/modules/auth/session.ts');
 assert.equal(await session.verifySession({get:()=>({value:'old-session-cookie'})}),null);
 const login=c.load('app/api/auth/login/route.ts');
 const response=await login.POST(c.request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'employee@example.test',password:c.password})}));
 assert.equal(response.status,503);assert.equal(response.cookies.get('zc_session'),undefined);assert.equal(c.sql.prepare("SELECT last_login_at FROM users WHERE id='employee'").get().last_login_at,null);
 const invalid=await login.POST(c.request('/api/auth/login',{method:'POST',body:'invalid-json'}));assert.equal(invalid.status,400);
});
test('detail API reads handle missing records without server errors',async()=>{
 const c=setup();const routes=[];function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else if(entry.name==='route.ts'&&file.includes('['))routes.push(file)}}collect('app/api');
 for(const actor of ['employee','admin']){c.setActor(actor);for(const file of routes){const route=c.load(file);if(typeof route.GET!=='function')continue;const url='/'+file.replace(/\\/g,'/').replace(/^app\//,'').replace(/\/route.ts$/,'').replace(/\[[^\]]+\]/g,'missing-fixture');const response=await route.GET(c.request(url),{params:Promise.resolve({id:'missing-fixture',userId:'missing-fixture',messageId:'missing-fixture',path:['missing-fixture']})});assert.ok(response.status<500,`${actor} ${file}: ${response.status} ${await response.text()}`)}}
});

test('dashboard training summary stays scoped to the signed-in student',async()=>{
 const c=setup();c.sql.exec("INSERT INTO learning_courses(id,title,description,status,created_by) VALUES('course','Fixture course','','published','admin'); INSERT INTO learning_lessons(id,course_id,title,content,required) VALUES('lesson','course','Lesson','Read this',1); INSERT INTO learning_assignments(user_id,course_id,required,assigned_by) VALUES('employee','course',1,'admin');");
 const route=c.load('app/api/training/summary/route.ts');
 let response=await route.GET(c.request('/api/training/summary?userId=admin'));let data=await response.json();assert.equal(data.assigned,1);assert.equal(data.requiredOutstanding,1);assert.equal(data.eligible,false);assert.equal(data.isAdmin,false);
 c.sql.exec("INSERT INTO learning_progress(user_id,lesson_id) VALUES('employee','lesson')");data=await (await route.GET(c.request('/api/training/summary'))).json();assert.equal(data.completed,1);assert.equal(data.eligible,true);
 c.setActor('admin');data=await (await route.GET(c.request('/api/training/summary?userId=employee'))).json();assert.equal(data.assigned,0);assert.equal(data.isAdmin,true);
});


test('only admins manage file departments; renamed folders preserve files and access',async()=>{
 const c=setup();const departments=c.load('app/api/files/departments/route.ts'),files=c.load('app/api/files/route.ts'),storage=c.load('app/api/storage/[...path]/route.ts');
 const save=(method,body)=>departments[method](c.request('/api/files/departments',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 c.setActor(null);assert.equal((await save('POST',{name:'Operations'})).status,401);
 c.setActor('employee');assert.equal((await save('POST',{name:'Operations'})).status,403);
 c.sql.prepare("UPDATE users SET department='Executive' WHERE id='employee'").run();assert.equal((await save('POST',{name:'Operations'})).status,403);
 c.setActor('admin');assert.equal((await save('POST',{name:'  Operations  '})).status,201);
 assert.equal((await save('POST',{name:'operations'})).status,409);
 assert.equal((await save('POST',{name:' '})).status,400);
 assert.equal((await save('POST',{name:'bad\nname'})).status,400);
 assert.equal((await save('PATCH',{id:'missing',name:'Missing'})).status,404);
 const data=new FormData();data.set('file',new File(['fixture'],'guide.pdf',{type:'application/pdf'}));data.set('department','Operations');
 let response=await files.POST(c.request('/api/files',{method:'POST',body:data}));assert.equal(response.status,200,await response.clone().text());
 const file=c.sql.prepare('SELECT * FROM files').get();assert.equal(file.department,'Operations');
 assert.equal((await save('PATCH',{id:'Operations',name:'Field Operations'})).status,200);
 assert.equal((await save('PATCH',{id:'Operations',name:'General'})).status,409);
 assert.equal(c.sql.prepare('SELECT department FROM files').get().department,'Operations');
 assert.equal(c.sql.prepare("SELECT department FROM users WHERE id='employee'").get().department,'Executive');
 const path=file.file_path.replace('/api/storage/','').split('/');
 for(const [department,allowed] of [['Operations',true],['Finance',false]]){
  c.sql.prepare("UPDATE users SET department=? WHERE id='employee'").run(department);c.setActor('employee');
  const result=await (await files.GET(c.request('/api/files'))).json();assert.equal(result.files.length,allowed?1:0);
  if(allowed){assert.equal(result.files[0].department_name,'Field Operations');assert.ok(result.departments.some(d=>d.name==='Field Operations'));}
  response=await storage.GET(c.request(file.file_path),{params:Promise.resolve({path})});assert.equal(response.status,allowed?200:404);
 }
 c.setActor('admin');assert.equal((await storage.GET(c.request(file.file_path),{params:Promise.resolve({path})})).status,200);
 const invalid=new FormData();invalid.set('file',new File(['x'],'bad.txt'));invalid.set('department','Nonexistent');
 assert.equal((await files.POST(c.request('/api/files',{method:'POST',body:invalid}))).status,400);
 // Migration is additive and safely repeatable, retaining display names.
 c.sql.exec(fs.readFileSync('migrations/009_file_departments.sql','utf8'));
 assert.equal(c.sql.prepare("SELECT name FROM file_departments WHERE id='Operations'").get().name,'Field Operations');
});
