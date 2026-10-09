const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
function setup(){
  const sql=new DatabaseSync(':memory:');
  sql.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,first_name TEXT,last_name TEXT,email TEXT,department TEXT,job_title TEXT,role TEXT); INSERT INTO users VALUES('admin','Admin','User','admin@test.local','Office','Admin','admin'),('employee','Test','Learner','learner@test.local','OnCall','Sales','employee'),('other','Other','Learner','other@test.local','OnCall','Sales','employee');");
  const migration=fs.readFileSync('migrations/007_training_and_assessment.sql','utf8');sql.exec(migration);sql.exec(migration);sql.exec(fs.readFileSync('migrations/010_employee_internships.sql','utf8'));
  sql.exec("ALTER TABLE users ADD COLUMN phone TEXT; ALTER TABLE users ADD COLUMN date_of_birth TEXT; CREATE TABLE employee_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),personal_email TEXT,alternate_phone TEXT,gender TEXT,start_date TEXT,city TEXT,province TEXT);");
  const db={prepare(query){const statement={args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(query).get(...this.args)||null;},async all(){return {results:sql.prepare(query).all(...this.args)};},async run(){return {meta:{changes:sql.prepare(query).run(...this.args).changes}};}};return statement;},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  sql.exec("CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT,text TEXT,type TEXT,link TEXT,is_read INTEGER,kind TEXT,entity_type TEXT,entity_id TEXT,actor_id TEXT,metadata_json TEXT);");
 let actor='admin';
  function load(path,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Response,URL,Date,console,TextEncoder,Uint8Array,crypto:require('node:crypto').webcrypto,require(name){if(extra[name])return extra[name];if(name==='next/server')return {};if(name==='@opennextjs/cloudflare')return {getCloudflareContext:async()=>({env:{DB:db}})};if(name==='@/src/modules/auth/session')return {verifySession:async()=>actor?{userId:actor}:null};return require(name);}});return exports;}
  const domain=load('src/modules/training/domain.ts'),documents=load('src/modules/documents/server.ts');
  const queries=load('src/modules/training/queries.ts'),notificationHelper=load('src/modules/backend/notifications.ts');
 const notifications=load('src/modules/training/notifications.ts',{'./domain':domain,'./queries':queries,'../backend/notifications':notificationHelper});
 const server=load('src/modules/training/server.ts',{'./domain':domain,'./queries':queries,'./notifications':notifications,'@/src/modules/documents/server':documents});
  const reconciliation=load('src/modules/training/reconciliation.ts',{'./domain':domain,'./server':server});
  const request=(body={},target)=>({headers:new Headers(),cookies:{},nextUrl:new URL('https://test.local/api/training'+(target?'?userId='+target:'')),json:async()=>body,text:async()=>JSON.stringify(body)});
  const post=async body=>{try{return await server.mutate(request(body));}catch(e){return server.failure(e);}};
  const get=async target=>{try{return await server.overview(request({},target));}catch(e){return server.failure(e);}};
  const act=async body=>{const r=await post(body);assert.equal(r.status,200,await r.clone().text());return r.json();};
  const reconcile=async body=>{try{return await reconciliation.reconcileRequest(request(body));}catch(e){return server.failure(e);}};
  return {sql,domain,post,get,act,reconcile,notifications,db,setActor:value=>actor=value};
}
async function course(c){const {id}=await c.act({action:'create_course',title:'Onboarding',description:''});const lesson=await c.act({action:'add_lesson',courseId:id,title:'Welcome',content:'Read the material',resourceUrl:''});await c.act({action:'create_quiz',courseId:id,title:'Knowledge check',passMark:100,required:true,questions:[{prompt:'Choose the right answer',options:['Wrong','Right'],correct:1}]});await c.act({action:'course_status',courseId:id,status:'published'});return {id,lessonId:lesson.id,quizId:c.sql.prepare('SELECT id FROM learning_quizzes').get().id};}
test('server enforces lesson and quiz eligibility, hides answers and preserves progress',async()=>{
  const c=setup(),courseData=await course(c);
  await c.act({action:'assign_course',userId:'employee',courseId:courseData.id,required:true});
  const aa=await c.act({action:'add_assessment',userId:'employee',requirementKey:'sales',description:'Three sales',measurementType:'numeric',target:3});
  const update={action:'update_assessment',userId:'employee',assessmentId:aa.id,progress:3,complete:true,evidence:'Confirmed'};
  assert.equal((await c.post(update)).status,409);
  c.setActor('employee');let data=await (await c.get()).json();assert.equal(data.eligible,false);assert.equal(data.quizzes[0].questions[0].correct,undefined);assert.equal(data.catalogQuizzes.length,0);
  assert.equal((await c.post({action:'submit_quiz',quizId:courseData.quizId,answers:[1]})).status,409);
  await c.act({action:'complete_lesson',lessonId:courseData.lessonId});
  await c.act({action:'submit_quiz',quizId:courseData.quizId,answers:[0],score:100,passed:true});
  data=await (await c.get()).json();assert.equal(data.eligible,false);assert.equal(data.attempts[0].score,0);
  await c.act({action:'submit_quiz',quizId:courseData.quizId,answers:[1]});assert.equal((await (await c.get()).json()).eligible,true);
  c.setActor('admin');await c.act(update);
  await c.act({action:'assign_course',userId:'employee',courseId:courseData.id,required:false});
  await c.act({action:'add_assessment',userId:'employee',requirementKey:'sales',description:'Three sales',measurementType:'numeric',target:3});
  assert.equal(c.sql.prepare('SELECT count(*) n FROM learning_assignments').get().n,1);
  assert.equal(c.sql.prepare('SELECT count(*) n FROM learning_assessments').get().n,1);
  assert.equal(c.sql.prepare('SELECT progress FROM learning_assessments').get().progress,3);
  assert.equal((await c.post({...update,progress:2})).status,400);
  assert.equal((await c.post({action:'add_lesson',courseId:courseData.id,title:'New',content:'New'})).status,409);
});
test('ownership, anonymous access and privileged operations are enforced',async()=>{
  const c=setup();c.setActor(null);assert.equal((await c.get()).status,401);
  c.setActor('employee');assert.equal((await c.get('other')).status,403);
  for(const action of ['create_course','assign_course','create_quiz','create_position','assign_position','update_assessment','add_assessment','require_course']) assert.equal((await c.post({action})).status,403,action);
  assert.equal((await c.post({action:'complete_lesson',userId:'other',lessonId:'fake'})).status,403);
  assert.equal((await c.post({action:'submit_quiz',quizId:'fake',answers:[0]})).status,403);
  assert.equal((await c.get()).status,200);assert.equal((await (await c.get()).json()).eligible,true);
});
test('position requirements assign once, individual targets and project outcomes remain distinct',async()=>{
  const c=setup();const courseData=await course(c);
  const p=await c.act({action:'create_position',title:'Intern',division:'Office',positionType:'Intern',description:'',measurementType:'project',target:null,reportDays:[1,5],reportFormat:'pdf'});
  await c.act({action:'require_course',positionId:p.id,courseId:courseData.id});
  for(let i=0;i<2;i++) await c.act({action:'assign_position',positionId:p.id,userId:'employee'});
  await c.act({action:'add_assessment',userId:'employee',requirementKey:'training-assistance',description:'Assist sessions',measurementType:'numeric',target:100});
  await c.act({action:'add_assessment',userId:'employee',requirementKey:'presentation',description:'Present recommendation',measurementType:'project'});
  assert.equal(c.sql.prepare('SELECT count(*) n FROM learning_candidates').get().n,1);
  assert.equal(c.sql.prepare('SELECT count(*) n FROM learning_assignments').get().n,1);
  assert.equal(c.sql.prepare("SELECT department FROM users WHERE id='employee'").get().department,'OnCall');
  assert.throws(()=>c.sql.exec("UPDATE learning_assessments SET progress=10 WHERE user_id='employee'"),/prerequisites/);
  assert.equal(c.sql.prepare('SELECT count(*) n FROM learning_assessments').get().n,2);
});
test('report schedule observes Johannesburg dates, late submissions and empty schedules',()=>{
  const {domain:d}=setup();assert.equal(d.localDate(new Date('2026-09-27T22:30:00Z')),'2026-09-28');
  const s=d.reportingStatus([1,5],'2026-09-21', [{due_date:'2026-09-21',submitted_at:'2026-09-21 22:30:00'}],'2026-09-26');
  assert.deepEqual([...s.missing],['2026-09-25']);assert.deepEqual([...s.late],['2026-09-21']);assert.equal(s.next,'2026-09-28');
  assert.equal(d.reportingStatus([],'2026-09-21',[],'2026-09-26').next,null);
  assert.throws(()=>d.validDate('2026-02-30'));assert.throws(()=>d.url('javascript:alert(1)'));
});
test('individual override preserves position progress and repeated assignments do not restore defaults',async()=>{
  const c=setup();const p=await c.act({action:'create_position',title:'Sales',division:'Sales',positionType:'Entry',description:'Default',measurementType:'numeric',target:3,reportDays:[],reportFormat:'pdf'});
  await c.act({action:'assign_position',positionId:p.id,userId:'employee'});
  const old=c.sql.prepare('SELECT id FROM learning_assessments').get().id;
  await c.act({action:'update_assessment',userId:'employee',assessmentId:old,progress:1,complete:false});
  await c.act({action:'add_assessment',userId:'employee',requirementKey:'individual',description:'Special project',measurementType:'project',overrideDefault:true});
  await c.act({action:'assign_position',positionId:p.id,userId:'employee'});
  const previous=c.sql.prepare('SELECT * FROM learning_assessments WHERE id=?').get(old);assert.equal(previous.active,0);assert.equal(previous.progress,1);
  assert.equal((await c.post({action:'update_assessment',userId:'employee',assessmentId:old,progress:2,complete:false})).status,404);
});
test('reconciliation is admin-only, requires review, detects stale values and cannot touch auth or identity numbers',async()=>{
  const c=setup();const proposal={action:'apply',reviewed:true,userId:'employee',field:'department',current:'OnCall',proposed:'Sales'};
  c.setActor('employee');assert.equal((await c.reconcile(proposal)).status,403);c.setActor('admin');
  assert.equal((await c.reconcile({...proposal,reviewed:false})).status,400);
  for(const field of ['role','password','email','identity_number']) assert.equal((await c.reconcile({...proposal,field})).status,400);
  assert.equal((await c.reconcile({...proposal,current:'Old department'})).status,409);
  assert.equal((await c.reconcile(proposal)).status,200);assert.equal((await c.reconcile(proposal)).status,200);
  assert.equal(c.sql.prepare("SELECT role FROM users WHERE id='employee'").get().role,'employee');
  assert.equal(c.sql.prepare("SELECT count(*) n FROM learning_audit WHERE action='profile_field_review'").get().n,1);
  const preview=await (await c.reconcile({action:'preview',report:{rows:[{source:'Sheet!5',name:'Test Learner',existing_name:'Test Learner',user_id:'employee',classification:'MATCHED',company_email:'learner@test.local',issues:[],fields_to_update:[{field:'department',current:'OnCall',proposed:'Office'}]}]}})).json();
  assert.equal(preview.rows[0].changes.length,0);assert.match(preview.rows[0].issues[0],/changed since dry run/);
});

test('assessment start cannot bypass training and completion notifications are idempotent',async()=>{
 const c=setup(),courseData=await course(c);
 const aa=await c.act({action:'add_assessment',userId:'employee',requirementKey:'start',description:'Project',measurementType:'project'});
 await c.act({action:'assign_course',userId:'employee',courseId:courseData.id,required:true,dueDate:'2026-09-20'});
 c.setActor('employee');
 assert.equal((await c.post({action:'start_assessment',assessmentId:aa.id})).status,409);
 await c.act({action:'complete_lesson',lessonId:courseData.lessonId});
 assert.equal((await c.post({action:'start_assessment',assessmentId:aa.id})).status,409);
 await c.act({action:'submit_quiz',quizId:courseData.quizId,answers:[1]});
 await c.act({action:'start_assessment',assessmentId:aa.id});
 assert.ok(c.sql.prepare('SELECT started_at FROM learning_assessments WHERE id=?').get(aa.id).started_at);
 await c.notifications.runTrainingNotifications(c.db);
 await c.notifications.runTrainingNotifications(c.db);
 assert.equal(c.sql.prepare("SELECT count(*) n FROM notifications WHERE kind='training_assigned'").get().n,1);
 assert.equal(c.sql.prepare("SELECT count(*) n FROM notifications WHERE kind='training_completed'").get().n,1);
 assert.equal(c.sql.prepare("SELECT count(*) n FROM notifications WHERE kind='assessment_unlocked'").get().n,1);
});
test('optional training does not block assessments and required courses each need completion',async()=>{
 const c=setup(),a=await course(c),b=await course(c);
 await c.act({action:'assign_course',userId:'employee',courseId:a.id,required:false});
 c.setActor('employee');assert.equal((await (await c.get()).json()).eligible,true);
 c.setActor('admin');
 await c.act({action:'assign_course',userId:'employee',courseId:b.id,required:true});
 c.setActor('employee');await c.act({action:'complete_lesson',lessonId:a.lessonId});
 await c.act({action:'submit_quiz',quizId:a.quizId,answers:[1]});
 assert.equal((await (await c.get()).json()).eligible,false);
});
