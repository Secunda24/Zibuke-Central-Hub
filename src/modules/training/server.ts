import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { NextRequest } from 'next/server';
import { documentContext } from '@/src/modules/documents/server';
import { days, eligible, grade, questions, localDate, measurement, reportingStatus, text, url, validDate } from './domain';
import {courseProgressSql,courseState,CourseProgress} from './queries';
import {runTrainingNotifications} from './notifications';

// Keep the existing admin/employee boundary. Position names never grant access.
export async function context(request: NextRequest, target?: string) {
  return documentContext(request, target);
}
export function failure(error: unknown) {
  if (error instanceof Response) return error;
  return Response.json({error:'Training setup is unavailable. Ask an administrator to check the database migration.'}, {status:503});
}
async function coursesFor(db: D1Database, userId: string) {
  const result = await db.prepare(courseProgressSql+' WHERE a.user_id=? ORDER BY c.title').bind(userId).all<CourseProgress>();
  return result.results.map(courseState);
}
export async function summary(request: NextRequest) {
  const {db,actor}=await context(request);
  const courses=await coursesFor(db,actor.id);
  const assessments=await db.prepare('SELECT count(*) AS count FROM learning_assessments WHERE user_id=? AND active=1 AND completed_at IS NULL').bind(actor.id).first<{count:number}>();
  return Response.json({
    assigned: courses.length,
    completed: courses.filter(course=>course.learning_status==='Completed').length,
    requiredOutstanding: courses.filter(course=>course.required&&course.learning_status!=='Completed').length,
    assessments: assessments?.count||0,
    eligible: eligible(courses),
    isAdmin: actor.role==='admin',
  },{headers:{'Cache-Control':'no-store'}});
}
export async function overview(request: NextRequest) {
  const {db,actor,userId}=await context(request,request.nextUrl.searchParams.get('userId')||undefined);
  const candidate=await db.prepare(`SELECT c.*,p.title,p.division,p.position_type,p.report_days,p.report_format FROM learning_candidates c JOIN learning_positions p ON p.id=c.position_id WHERE c.user_id=?`).bind(userId).first<Pick<DatabaseRows["learning_candidates"], "user_id" | "position_id" | "candidate_group" | "territory" | "qualification" | "institution" | "start_date" | "assigned_by" | "assigned_at"> & Pick<DatabaseRows["learning_positions"], "title" | "division" | "position_type" | "report_days" | "report_format">>();
  const courses=await coursesFor(db,userId);
  const lessons=await db.prepare(`SELECT l.*,s.title section_title,p.completed_at FROM learning_lessons l JOIN learning_assignments a ON a.course_id=l.course_id LEFT JOIN learning_sections s ON s.id=l.section_id LEFT JOIN learning_progress p ON p.lesson_id=l.id AND p.user_id=a.user_id WHERE a.user_id=? ORDER BY COALESCE(s.sort_order,0),l.sort_order,l.title`).bind(userId).all<Pick<DatabaseRows["learning_lessons"], "id" | "course_id" | "section_id" | "title" | "content" | "resource_url" | "sort_order" | "kind" | "required" | "duration_minutes" | "storage_key" | "content_type"> & Pick<DatabaseRows["learning_progress"], "completed_at"> & {"section_title":string}>();
  const lessonFileRows=(await db.prepare('SELECT f.id,f.lesson_id,f.kind,f.content_type,f.filename,f.size FROM learning_lesson_files f WHERE f.lesson_id IN (SELECT l.id FROM learning_lessons l JOIN learning_assignments a ON a.course_id=l.course_id WHERE a.user_id=?) ORDER BY f.sort_order').bind(userId).all<{id:string;lesson_id:string;kind:string;content_type:string;filename:string;size:number}>()).results;
  const filesByLesson=new Map<string,{id:string;kind:string;content_type:string;filename:string;size:number}[]>();
  for(const file of lessonFileRows){const list=filesByLesson.get(file.lesson_id)||[];list.push({id:file.id,kind:file.kind,content_type:file.content_type,filename:file.filename,size:file.size});filesByLesson.set(file.lesson_id,list);}
  const assessments=await db.prepare('SELECT * FROM learning_assessments WHERE user_id=? ORDER BY created_at,id').bind(userId).all<Pick<DatabaseRows["learning_assessments"], "id" | "user_id" | "requirement_key" | "description" | "measurement_type" | "target" | "progress" | "started_at" | "completed_at" | "evidence" | "active" | "is_override" | "assigned_by" | "created_at">>();
  const submissions=await db.prepare('SELECT * FROM tracking_submissions WHERE user_id=? ORDER BY due_date DESC').bind(userId).all<Pick<DatabaseRows["tracking_submissions"], "id" | "user_id" | "due_date" | "evidence_url" | "notes" | "submitted_at">>();
  const person=await db.prepare('SELECT id,first_name,last_name,email,department,job_title,role FROM users WHERE id=?').bind(userId).first<Pick<DatabaseRows["users"], "id" | "first_name" | "last_name" | "email" | "department" | "job_title" | "role">>();
  if(!person)throw new Response("Employee not found",{status:404});
  const catalog=actor.role==='admin'?await db.prepare('SELECT * FROM learning_courses ORDER BY title').all<Pick<DatabaseRows["learning_courses"], "id" | "title" | "description" | "status" | "created_by" | "created_at">>():{results:[]};
  const positions=actor.role==='admin'?await db.prepare('SELECT * FROM learning_positions ORDER BY division,title').all<Pick<DatabaseRows["learning_positions"], "id" | "title" | "division" | "position_type" | "assessment_description" | "assessment_type" | "assessment_target" | "report_days" | "report_format" | "created_by" | "created_at">>():{results:[]};
  const people=actor.role==='admin'?await db.prepare('SELECT id,first_name,last_name FROM users WHERE archived_at IS NULL ORDER BY first_name,last_name').all<Pick<DatabaseRows["users"], "id" | "first_name" | "last_name">>():{results:[]};
  const prerequisites=actor.role==='admin'?await db.prepare('SELECT * FROM learning_position_courses').all<Pick<DatabaseRows["learning_position_courses"], "position_id" | "course_id">>():{results:[]};
  const quizzes=await db.prepare(`SELECT q.* FROM learning_quizzes q JOIN learning_assignments a ON a.course_id=q.course_id WHERE a.user_id=?`).bind(userId).all<Pick<DatabaseRows["learning_quizzes"], "id" | "course_id" | "title" | "pass_mark" | "required" | "questions">>();
  const attempts=await db.prepare('SELECT * FROM learning_quiz_attempts WHERE user_id=? ORDER BY attempted_at DESC').bind(userId).all<Pick<DatabaseRows["learning_quiz_attempts"], "id" | "user_id" | "quiz_id" | "score" | "passed" | "attempted_at">>();
  const catalogLessons=actor.role==='admin'?await db.prepare('SELECT * FROM learning_lessons ORDER BY title').all<Pick<DatabaseRows["learning_lessons"], "id" | "course_id" | "section_id" | "title" | "content" | "resource_url" | "sort_order" | "kind" | "required" | "duration_minutes" | "storage_key" | "content_type">>():{results:[]};
  const catalogQuizzes=actor.role==='admin'?await db.prepare('SELECT * FROM learning_quizzes ORDER BY title').all<Pick<DatabaseRows["learning_quizzes"], "id" | "course_id" | "title" | "pass_mark" | "required" | "questions">>():{results:[]};
  const sections=actor.role==='admin'?await db.prepare('SELECT * FROM learning_sections ORDER BY sort_order,title').all<Pick<DatabaseRows["learning_sections"], "id" | "course_id" | "title" | "sort_order">>():{results:[]};
  const internship=await db.prepare('SELECT status,started_at,target_date,qualified_at,qualification_evidence FROM employee_internships WHERE user_id=?').bind(userId).first();
  return Response.json({person,internship,isAdmin:actor.role==='admin',candidate,courses,lessons:lessons.results.map((lesson)=>({...lesson,files:filesByLesson.get(lesson.id)??[]})),assessments:assessments.results,eligible:eligible(courses),submissions:submissions.results,
    quizzes:quizzes.results.map((q)=>({...q,questions:JSON.parse(q.questions).map(({prompt,options}:{prompt:string;options:string[]})=>({prompt,options}))})),attempts:attempts.results,catalogLessons:catalogLessons.results,catalogQuizzes:catalogQuizzes.results,sections:sections.results,
    reporting:candidate?reportingStatus(JSON.parse(candidate.report_days),candidate.assigned_at,submissions.results):null,
    catalog:catalog.results,positions:positions.results,people:people.results,prerequisites:prerequisites.results,
    access:{role:person.role,scope:person.role==='admin'?'All employee training and assessment records':'Own training, assessment and reporting records',positionGrants:[]}}, {headers:{'Cache-Control':'no-store'}});
}
export async function mutate(request: NextRequest) {
  if (Number(request.headers.get('content-length')||0)>100000) throw new Response('Request too large',{status:413});
  const body=await request.json();
  if(!body || typeof body!=='object' || Array.isArray(body)) throw new Response('Invalid request',{status:400});
  if(body.userId!==undefined) text(body.userId,'employee',100);
  const {db,actor,userId}=await context(request,body.userId);
  const action=text(body.action,'action',40);
  const selfActions=['complete_lesson','submit_report','submit_quiz','start_assessment','start_course'];
  if (!selfActions.includes(action) && actor.role!=='admin') throw new Response('Forbidden',{status:403});
  const statements:D1PreparedStatement[]=[];
  let entityId='';
  const id=(value:unknown)=>text(value,'identifier',100);
  const exists=async(table:string,value:string)=>{if(!await db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(value).first()) throw new Response('Record not found',{status:404});};
  const editableCourse=async(courseId:string)=>{const course=await db.prepare('SELECT status FROM learning_courses WHERE id=?').bind(courseId).first<Pick<DatabaseRows["learning_courses"], "status">>();if(!course||course.status!=='draft')throw new Response('Only draft courses can be changed. Create a new version for published content.',{status:409});};
  const publishedCourse=async(courseId:string)=>{const course=await db.prepare("SELECT id FROM learning_courses WHERE id=? AND status='published'").bind(courseId).first<Pick<DatabaseRows["learning_courses"], "id">>();if(!course)throw new Response('Publish the course before assigning it',{status:409});};
  if(action==='create_course') {
    entityId=crypto.randomUUID();
    statements.push(db.prepare('INSERT INTO learning_courses(id,title,description,created_by) VALUES(?,?,?,?)').bind(entityId,text(body.title,'course title',200),text(body.description??'','description',5000,true),actor.id));
  } else if(action==='course_status') {
    entityId=id(body.courseId);
    if(!['published','archived'].includes(body.status))throw new Response('Invalid course status',{status:400});
    await exists('learning_courses',entityId);
    if(body.status==='published'&&!(await db.prepare('SELECT count(*) count FROM learning_lessons WHERE course_id=? AND required=1').bind(entityId).first<{"count":number}>())?.count)throw new Response('Add at least one required lesson before publishing',{status:400});
    if(body.status==='published'&&(await db.prepare("SELECT count(*) count FROM learning_lessons WHERE course_id=? AND kind IN ('video','document','external') AND COALESCE(resource_url,'')='' AND COALESCE(storage_key,'')=''").bind(entityId).first<{"count":number}>())?.count)throw new Response('Add a resource to each media lesson before publishing',{status:400});
    statements.push(db.prepare('UPDATE learning_courses SET status=? WHERE id=?').bind(body.status,entityId));
  } else if(action==='add_section') {
    const courseId=id(body.courseId);await editableCourse(courseId);entityId=crypto.randomUUID();
    if(!Number.isInteger(body.sortOrder)||body.sortOrder<0)throw new Response('Invalid section order',{status:400});
    statements.push(db.prepare('INSERT INTO learning_sections(id,course_id,title,sort_order) VALUES(?,?,?,?)').bind(entityId,courseId,text(body.title,'section title',200),body.sortOrder));
  } else if(action==='start_course') {
    entityId=id(body.courseId);
    if(!await db.prepare('SELECT 1 FROM learning_assignments WHERE user_id=? AND course_id=?').bind(userId,entityId).first<{"1":string}>())throw new Response('Course not assigned',{status:403});
    statements.push(db.prepare('UPDATE learning_assignments SET started_at=COALESCE(started_at,CURRENT_TIMESTAMP) WHERE user_id=? AND course_id=?').bind(userId,entityId));
  } else if(action==='start_assessment') {
    entityId=id(body.assessmentId);
    if(!eligible(await coursesFor(db,userId)))throw new Response('Complete compulsory lessons and required quizzes first',{status:409});
    if(!await db.prepare('SELECT id FROM learning_assessments WHERE id=? AND user_id=? AND active=1').bind(entityId,userId).first<Pick<DatabaseRows["learning_assessments"], "id">>())throw new Response('Assessment not found',{status:404});
    statements.push(db.prepare('UPDATE learning_assessments SET started_at=COALESCE(started_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?').bind(entityId,userId));
  } else if(action==='create_quiz') {
    const courseId=id(body.courseId);await exists('learning_courses',courseId);entityId=crypto.randomUUID();
    await editableCourse(courseId);
    if(await db.prepare('SELECT 1 FROM learning_assignments WHERE course_id=? LIMIT 1').bind(courseId).first<{"1":string}>()) throw new Response('Create a new course version to change an assigned course',{status:409});
    if(!Number.isInteger(body.passMark)||body.passMark<1||body.passMark>100||typeof body.required!=='boolean') throw new Response('Choose a pass mark from 1 to 100 and whether the quiz is required',{status:400});
    statements.push(db.prepare('INSERT INTO learning_quizzes(id,course_id,title,pass_mark,required,questions) VALUES(?,?,?,?,?,?)').bind(entityId,courseId,text(body.title,'quiz title',200),body.passMark,body.required?1:0,JSON.stringify(questions(body.questions))));
  } else if(action==='submit_quiz') {
    entityId=id(body.quizId);
    if(actor.id!==userId) throw new Response('Quizzes must be answered by the assigned employee',{status:403});
    const quiz=await db.prepare('SELECT q.* FROM learning_quizzes q JOIN learning_assignments a ON a.course_id=q.course_id WHERE q.id=? AND a.user_id=?').bind(entityId,userId).first<Pick<DatabaseRows["learning_quizzes"], "id" | "course_id" | "title" | "pass_mark" | "required" | "questions">>();
    if(!quiz) throw new Response('Quiz not assigned',{status:403});
    const course=(await coursesFor(db,userId)).find((c)=>c.id===quiz.course_id);
    if(!course||!course.total||course.completed<course.total) throw new Response('Complete the course lessons first',{status:409});
    const recent=await db.prepare("SELECT count(*) count FROM learning_quiz_attempts WHERE user_id=? AND quiz_id=? AND attempted_at>datetime('now','-1 hour')").bind(userId,entityId).first<{"count":number}>();
    if((recent?.count??0)>=10) throw new Response('Ten attempts per hour are allowed. Review the lessons and try again later.',{status:429});
    const result=grade(JSON.parse(quiz.questions),body.answers,quiz.pass_mark);
    statements.push(db.prepare('INSERT INTO learning_quiz_attempts(id,user_id,quiz_id,score,passed) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),userId,entityId,result.score,result.passed?1:0));
  } else if(action==='add_lesson') {
    const courseId=id(body.courseId);await exists('learning_courses',courseId);entityId=crypto.randomUUID();
    await editableCourse(courseId);
    // Courses become immutable once assigned, so adding lessons cannot reset completion or eligibility.
    if(await db.prepare('SELECT 1 FROM learning_assignments WHERE course_id=? LIMIT 1').bind(courseId).first<{"1":string}>()) throw new Response('This course is assigned. Create a new course version to add lessons without resetting progress.',{status:409});
    const sectionId=body.sectionId?id(body.sectionId):null;
    if(sectionId&&!await db.prepare('SELECT id FROM learning_sections WHERE id=? AND course_id=?').bind(sectionId,courseId).first<Pick<DatabaseRows["learning_sections"], "id">>())throw new Response('Section belongs to a different course',{status:400});
    const kind=body.kind||'text';if(!['text','video','document','external'].includes(kind))throw new Response('Invalid lesson type',{status:400});
    const order=body.sortOrder??0,duration=body.durationMinutes??0;
    if(!Number.isInteger(order)||order<0||!Number.isInteger(duration)||duration<0||duration>10000)throw new Response('Invalid lesson order or duration',{status:400});
    statements.push(db.prepare('INSERT INTO learning_lessons(id,course_id,section_id,title,content,resource_url,kind,required,sort_order,duration_minutes) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(entityId,courseId,sectionId,text(body.title,'lesson title',200),text(body.content,'lesson content',20000),url(body.resourceUrl,true),kind,body.required===false?0:1,order,duration));
  } else if(action==='create_position') {
    entityId=crypto.randomUUID();const m=measurement(body.measurementType,body.target);
    if(!['pdf','video'].includes(body.reportFormat)) throw new Response('Invalid report format',{status:400});
    statements.push(db.prepare('INSERT INTO learning_positions(id,title,division,position_type,assessment_description,assessment_type,assessment_target,report_days,report_format,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(entityId,text(body.title,'position title',200),text(body.division,'division',200),text(body.positionType,'position type',100),text(body.description??'','assessment description',5000,true),m.type,m.target,JSON.stringify(days(body.reportDays)),body.reportFormat,actor.id));
  } else if(action==='require_course') {
    const positionId=id(body.positionId),courseId=id(body.courseId);await exists('learning_positions',positionId);await exists('learning_courses',courseId);entityId=positionId;
    await publishedCourse(courseId);
    if(!(await db.prepare('SELECT count(*) count FROM learning_lessons WHERE course_id=?').bind(courseId).first<{"count":number}>())?.count) throw new Response('Add lessons before requiring this course',{status:400});
    statements.push(db.prepare('INSERT OR IGNORE INTO learning_position_courses(position_id,course_id) VALUES(?,?)').bind(positionId,courseId));
    statements.push(db.prepare('INSERT INTO learning_assignments(user_id,course_id,required,assigned_by) SELECT user_id,?,1,? FROM learning_candidates WHERE position_id=? ON CONFLICT(user_id,course_id) DO UPDATE SET required=1').bind(courseId,actor.id,positionId));
  } else if(action==='assign_position') {
    const positionId=id(body.positionId);const position=await db.prepare('SELECT * FROM learning_positions WHERE id=?').bind(positionId).first<Pick<DatabaseRows["learning_positions"], "id" | "title" | "division" | "position_type" | "assessment_description" | "assessment_type" | "assessment_target" | "report_days" | "report_format" | "created_by" | "created_at">>();
    if(!position) throw new Response('Position not found',{status:404});entityId=positionId;
    const current=await db.prepare('SELECT position_id FROM learning_candidates WHERE user_id=?').bind(userId).first<Pick<DatabaseRows["learning_candidates"], "position_id">>();
    if(current && current.position_id!==positionId) throw new Response('Changing a learning position requires a reviewed transition. Existing progress has been preserved.',{status:409});
    statements.push(db.prepare('INSERT OR IGNORE INTO learning_candidates(user_id,position_id,candidate_group,territory,qualification,institution,start_date,assigned_by) VALUES(?,?,?,?,?,?,?,?)').bind(userId,positionId,text(body.group??'','group',200,true),text(body.territory??'','territory',200,true),text(body.qualification??'','qualification',300,true),text(body.institution??'','institution',300,true),body.startDate?validDate(body.startDate):null,actor.id));
    statements.push(db.prepare('INSERT INTO learning_assignments(user_id,course_id,required,assigned_by) SELECT ?,course_id,1,? FROM learning_position_courses WHERE position_id=? ON CONFLICT(user_id,course_id) DO UPDATE SET required=1').bind(userId,actor.id,positionId));
    if(position.assessment_description) statements.push(db.prepare('INSERT OR IGNORE INTO learning_assessments(id,user_id,requirement_key,description,measurement_type,target,assigned_by) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM learning_assessments WHERE user_id=? AND is_override=1 AND active=1)').bind(crypto.randomUUID(),userId,`position:${positionId}`,position.assessment_description,position.assessment_type,position.assessment_target,actor.id,userId));
  } else if(action==='assign_course') {
    const courseId=id(body.courseId);await exists('learning_courses',courseId);entityId=courseId;
    await publishedCourse(courseId);
    if(!(await db.prepare('SELECT count(*) count FROM learning_lessons WHERE course_id=?').bind(courseId).first<{"count":number}>())?.count) throw new Response('Add lessons before assigning this course',{status:400});
    if(typeof body.required!=='boolean') throw new Response('Choose whether the course is compulsory',{status:400});
    // Repeated assignments preserve progress and never silently remove an existing prerequisite.
    statements.push(db.prepare('INSERT INTO learning_assignments(user_id,course_id,required,due_date,assigned_by) VALUES(?,?,?,?,?) ON CONFLICT(user_id,course_id) DO UPDATE SET required=MAX(required,excluded.required)').bind(userId,courseId,body.required?1:0,body.dueDate?validDate(body.dueDate):null,actor.id));
  } else if(action==='set_due_date') {
    entityId=id(body.courseId);
    if(!await db.prepare('SELECT 1 FROM learning_assignments WHERE user_id=? AND course_id=?').bind(userId,entityId).first<{"1":string}>())throw new Response('Course not assigned',{status:404});
    statements.push(db.prepare('UPDATE learning_assignments SET due_date=? WHERE user_id=? AND course_id=?').bind(body.dueDate?validDate(body.dueDate):null,userId,entityId));
  } else if(action==='complete_lesson') {
    entityId=id(body.lessonId);
    const assigned=await db.prepare('SELECT 1 FROM learning_assignments a JOIN learning_lessons l ON l.course_id=a.course_id WHERE a.user_id=? AND l.id=?').bind(userId,entityId).first<{"1":string}>();
    if(!assigned) throw new Response('Lesson is not assigned to this person',{status:403});
    statements.push(db.prepare('INSERT OR IGNORE INTO learning_progress(user_id,lesson_id) VALUES(?,?)').bind(userId,entityId));
    statements.push(db.prepare('UPDATE learning_assignments SET started_at=COALESCE(started_at,CURRENT_TIMESTAMP) WHERE user_id=? AND course_id=(SELECT course_id FROM learning_lessons WHERE id=?)').bind(userId,entityId));
  } else if(action==='add_assessment') {
    entityId=crypto.randomUUID();const m=measurement(body.measurementType,body.target);
    const requirementKey=text(body.requirementKey,'requirement reference',150);
    if(requirementKey.startsWith('position:')) throw new Response('Choose an individual requirement reference',{status:400});
    if(body.overrideDefault===true) statements.push(db.prepare("UPDATE learning_assessments SET active=0 WHERE user_id=? AND requirement_key LIKE 'position:%'").bind(userId));
    // Stable key allows independent intern outcomes, and makes repeated imports safe.
    const previous=await db.prepare('SELECT description,measurement_type,target,is_override FROM learning_assessments WHERE user_id=? AND requirement_key=?').bind(userId,requirementKey).first<Pick<DatabaseRows["learning_assessments"], "description" | "measurement_type" | "target" | "is_override">>();
    const description=text(body.description,'assessment description',5000);
    if(previous&&(previous.description!==description||previous.measurement_type!==m.type||previous.target!==m.target||previous.is_override!==(body.overrideDefault===true?1:0))) throw new Response('That reference already has a different requirement. Use a new reference; previous progress is preserved.',{status:409});
    statements.push(db.prepare('INSERT OR IGNORE INTO learning_assessments(id,user_id,requirement_key,description,measurement_type,target,is_override,assigned_by) VALUES(?,?,?,?,?,?,?,?)').bind(entityId,userId,requirementKey,description,m.type,m.target,body.overrideDefault===true?1:0,actor.id));
  } else if(action==='update_assessment') {
    entityId=id(body.assessmentId);
    const assessment=await db.prepare('SELECT * FROM learning_assessments WHERE id=? AND user_id=?').bind(entityId,userId).first<Pick<DatabaseRows["learning_assessments"], "id" | "user_id" | "requirement_key" | "description" | "measurement_type" | "target" | "progress" | "started_at" | "completed_at" | "evidence" | "active" | "is_override" | "assigned_by" | "created_at">>();
    if(!assessment||!assessment.active) throw new Response('Active assessment not found',{status:404});
    if(!eligible(await coursesFor(db,userId))) throw new Response('Complete compulsory training before recording assessment progress',{status:409});
    if(typeof body.progress!=='number'||!Number.isFinite(body.progress)||body.progress<assessment.progress) throw new Response('Progress must be a non-negative number and cannot decrease',{status:400});
    if(typeof body.complete!=='boolean') throw new Response('Invalid completion state',{status:400});
    if(assessment.measurement_type==='numeric'&&assessment.target===null)throw new Response('Assessment target is missing',{status:409});
    const complete=assessment.measurement_type==='numeric'?body.progress>=(assessment.target??Infinity):body.complete;
    statements.push(db.prepare('UPDATE learning_assessments SET progress=MAX(progress,?), evidence=?, completed_at=CASE WHEN ? THEN COALESCE(completed_at,CURRENT_TIMESTAMP) ELSE completed_at END WHERE id=? AND user_id=?').bind(body.progress,text(body.evidence??'','assessment evidence',5000,true),complete?1:0,entityId,userId));
  } else if(action==='submit_report') {
    const due=validDate(body.dueDate);entityId=crypto.randomUUID();
    const candidate=await db.prepare('SELECT c.assigned_at,p.report_days FROM learning_candidates c JOIN learning_positions p ON p.id=c.position_id WHERE c.user_id=?').bind(userId).first<Pick<DatabaseRows["learning_candidates"], "assigned_at"> & Pick<DatabaseRows["learning_positions"], "report_days">>();
    if(!candidate||!JSON.parse(candidate.report_days).includes(new Date(`${due}T00:00:00Z`).getUTCDay())||due<candidate.assigned_at.slice(0,10)||due>localDate()) throw new Response('Choose a scheduled reporting date, from assignment through today',{status:400});
    statements.push(db.prepare('INSERT OR IGNORE INTO tracking_submissions(id,user_id,due_date,evidence_url,notes) VALUES(?,?,?,?,?)').bind(entityId,userId,due,url(body.evidenceUrl),text(body.notes??'','report notes',5000,true)));
  } else throw new Response('Unknown action',{status:400});
  statements.push(db.prepare('INSERT INTO learning_audit(id,actor_id,user_id,action,entity_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,userId,action,entityId));
  await db.batch(statements);
  try { await runTrainingNotifications(db,userId); } catch (error) { console.error("Training notification delivery deferred to scheduled retry",error); }
  return Response.json({ok:true,id:entityId});
}
