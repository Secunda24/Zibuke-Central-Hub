const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{exports,URL,require:n=>{if(!(n in deps))throw Error(n);return deps[n]}});return exports;}
const library=load('src/modules/search/library.ts',{'@/src/modules/assistant/knowledge.json':JSON.parse(fs.readFileSync(path.join(root,'src/modules/assistant/knowledge.json'),'utf8'))});
function setup(userId='u1'){
 const sql=new DatabaseSync(':memory:');sql.exec(`
 CREATE TABLE users(id TEXT,first_name TEXT,last_name TEXT,email TEXT,role TEXT,department TEXT);
 INSERT INTO users VALUES('u1','One','User','one@test','employee','Engineering'),('u2','Two','User','two@test','employee','Finance'),('u3','Three','User','three@test','admin','Executive');
 CREATE TABLE messages(id TEXT,content TEXT,sender_id TEXT,receiver_id TEXT,created_at TEXT,deleted_at TEXT,is_deleted INTEGER);
 INSERT INTO messages VALUES('mine','needle private message','u1','u2','2026',NULL,0),('other','needle hidden','u2','u3','2026',NULL,0),('deleted','needle deleted','u1','u2','2026',NULL,1),('removed','needle removed','u1','u2','2026','2026',0);
 CREATE TABLE channels(id TEXT,name TEXT,description TEXT,created_by TEXT,visibility TEXT,archived_at TEXT);
 INSERT INTO channels VALUES('public','needle public','team','u2','company',NULL),('private','needle private','team','u2','private',NULL),('joined','needle joined','team','u2','private',NULL);
 CREATE TABLE channel_members(channel_id TEXT,user_id TEXT);INSERT INTO channel_members VALUES('joined','u1');
 CREATE TABLE channel_messages(id TEXT,channel_id TEXT,content TEXT,created_at TEXT,deleted_at TEXT,is_deleted INTEGER);
 INSERT INTO channel_messages VALUES('cm1','public','needle public','2026',NULL,0),('cm2','private','needle private','2026',NULL,0),('cm3','joined','needle joined','2026',NULL,0),('cm4','joined','needle removed','2026',NULL,1);
 CREATE TABLE announcements(id TEXT,title TEXT,content TEXT,category TEXT,status TEXT,scheduled_at TEXT,audience_type TEXT,audience_value TEXT,created_at TEXT);
 INSERT INTO announcements VALUES('a1','needle announcement','text','general','published',NULL,'department','Engineering','2026'),('a2','needle finance','text','general','published',NULL,'department','Finance','2026'),('draft','needle draft','text','general','draft',NULL,'company',NULL,'2026');
 CREATE TABLE file_departments(id TEXT PRIMARY KEY,name TEXT);
 CREATE TABLE files(id TEXT,filename TEXT,department TEXT,created_at TEXT);
 INSERT INTO files VALUES('f1','needle.pdf','Engineering','2026'),('f2','needle-private.pdf','Finance','2026'),('f3','100%_done.pdf','General','2026');
 CREATE TABLE events(id TEXT,title TEXT,description TEXT,start_time TEXT,cancelled_at TEXT,organizer_id TEXT,event_type TEXT,channel_id TEXT);
 INSERT INTO events VALUES('e1','needle meeting','text','2026',NULL,'u1','meeting',NULL),('e2','needle hidden','text','2026',NULL,'u2','meeting',NULL),('e3','needle invite','text','2026',NULL,'u2','meeting',NULL);
 CREATE TABLE event_attendees(event_id TEXT,user_id TEXT);INSERT INTO event_attendees VALUES('e3','u1');
 CREATE TABLE updates(id TEXT,content TEXT,created_at TEXT);INSERT INTO updates VALUES('p1','needle post','2026');
 CREATE TABLE notifications(id TEXT,user_id TEXT,content TEXT,created_at TEXT);INSERT INTO notifications VALUES('n1','u1','needle notification','2026'),('n2','u2','needle hidden','2026');
 `);
 const db={prepare(query){return {all:async()=>({results:sql.prepare(query).all()}),bind(...args){return {all:async()=>({results:sql.prepare(query).all(...args)}),first:async()=>sql.prepare(query).get(...args)}}}}};
 const route=load('app/api/search/route.ts',{
 'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}},
 '@opennextjs/cloudflare':{getCloudflareContext:async()=>({env:{DB:db}})},
 '@/src/modules/auth/session':{verifySession:async()=>userId?{userId}:null},
 '@/src/modules/search/library':library});
 return {sql,get:q=>route.GET({url:'https://app.test/api/search?'+q,cookies:{}})};
}
test('search enforces live SQL permissions and excludes deleted content',async()=>{
 const {get,sql}=setup();try{const r=await get('q=needle');assert.equal(r.status,200);assert.deepEqual(Array.from(r.body.unavailable),[]);
 const ids=r.body.results.map(x=>x.id);for(const id of ['mine','public','joined','cm1','cm3','a1','f1','e1','e3','p1','n1'])assert.ok(ids.includes(id),id);
 for(const id of ['other','deleted','removed','private','cm2','cm4','a2','draft','f2','e2','n2'])assert.ok(!ids.includes(id),id);
 assert.equal(r.headers['Cache-Control'],'no-store');}finally{sql.close();}
});
test('SQL wildcard characters are treated literally',async()=>{const {get,sql}=setup();try{const r=await get('q='+encodeURIComponent('%_'));assert.equal(r.body.results.length,1);assert.equal(r.body.results[0].id,'f3');}finally{sql.close();}});
test('anonymous access fails and source filters work',async()=>{let s=setup(null);try{assert.equal((await s.get('q=needle')).status,401);}finally{s.sql.close();}s=setup();try{assert.equal((await s.get('q=needle&source=invalid')).status,400);const r=await s.get('q=plumbing&source=oncall');assert.ok(r.body.results.length>0);assert.ok(r.body.results.every(x=>x.source==='oncall'));}finally{s.sql.close();}});
test('missing category does not hide other results or silently imply completeness',async()=>{const {get,sql}=setup();try{sql.exec('DROP TABLE files');const r=await get('q=needle');assert.equal(r.status,200);assert.ok(r.body.unavailable.includes('Files'));assert.ok(r.body.results.some(x=>x.id==='mine'));}finally{sql.close();}});
test('website ranking deduplicates pages and hides admin help',()=>{const refs=library.searchLibrary('admin',false);assert.ok(refs.every(x=>x.href!=='/dashboard/admin'));const websites=library.searchLibrary('plumbing',false);assert.equal(new Set(websites.map(x=>x.href)).size,websites.length);assert.ok(library.searchLibrary('admin',true).some(x=>x.href==='/dashboard/admin'));});
test('pagination returns separate result pages',async()=>{const {get,sql}=setup();try{for(let i=0;i<28;i++)sql.prepare('INSERT INTO files VALUES(?,?,?,?)').run('page'+i,'pagination '+i,'General','2026');const a=await get('q=pagination&page=1');const b=await get('q=pagination&page=2');assert.equal(a.body.results.length,20);assert.equal(a.body.hasMore,true);assert.equal(b.body.results.length,8);assert.equal(b.body.hasMore,false);assert.ok(!b.body.results.some(x=>a.body.results.some(y=>x.id===y.id)));}finally{sql.close();}});
