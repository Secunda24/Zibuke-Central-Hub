import {createNotification} from '../backend/notifications';
import {courseProgressSql,courseState,CourseProgress} from './queries';
import {eligible,localDate} from './domain';
export async function runTrainingNotifications(db: D1Database,userId?:string){
 const {results}=await db.prepare(courseProgressSql+(userId?' WHERE a.user_id=?':'')).bind(...(userId?[userId]:[])).all<CourseProgress>();
 const grouped=new Map<string,CourseProgress[]>(),today=localDate(),soon=localDate(new Date(Date.now()+2*86400000));
 for(const row of results){
  grouped.set(row.user_id,[...(grouped.get(row.user_id)||[]),row]);
  const notify=(kind:string,content:string,suffix='')=>createNotification(db,{id:`training:${kind}:${row.user_id}:${row.id}${suffix}`,userId:row.user_id,kind:`training_${kind}`,content,entityType:'training',entityId:row.id});
  await notify('assigned',`Training assigned: ${row.title}`);
  if(courseState(row).learning_status==='Completed')await notify('completed',`Training completed: ${row.title}`);
  else if(row.due_date&&row.due_date<today)await notify('overdue',`Training overdue: ${row.title} (due ${row.due_date})`,':'+row.due_date);
  else if(row.due_date&&row.due_date<=soon)await notify('due',`Training due soon: ${row.title} (${row.due_date})`,':'+row.due_date);
 }
 for(const [id,courses] of grouped){
  const required=courses.filter(c=>c.required);
  if(required.length&&eligible(required)){
   // Stable prerequisite set: repeated completion calls and cron executions cannot duplicate unlock alerts.
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(required.map(c=>c.id).sort().join('|')));
   const key=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
   await createNotification(db,{id:`assessment-unlocked:${id}:${key}`,userId:id,kind:'assessment_unlocked',content:'Your compulsory training and quizzes are complete. Your accountability assessment is unlocked.',entityType:'training'});
  }
 }
 return {assignments:results.length};
}
