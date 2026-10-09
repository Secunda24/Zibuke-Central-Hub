import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import {NextRequest} from 'next/server';
import {context,failure} from '@/src/modules/training/server';
import {courseProgressSql,courseState,CourseProgress} from '@/src/modules/training/queries';
import {eligible,localDate} from '@/src/modules/training/domain';
export async function GET(request:NextRequest){
 try {
  const {db,actor}=await context(request);if(actor.role!=='admin')throw new Response('Forbidden',{status:403});
  const {results}=await db.prepare(courseProgressSql).all<CourseProgress>();
  const people=await db.prepare('SELECT u.id,u.email,u.first_name,u.last_name,u.department,u.job_title,i.status AS internship_status,i.started_at AS internship_started_at,i.target_date,i.qualified_at,i.qualification_evidence FROM users u LEFT JOIN employee_internships i ON i.user_id=u.id WHERE u.archived_at IS NULL ORDER BY u.first_name,u.last_name').all<Pick<DatabaseRows["users"], "id" | "email" | "first_name" | "last_name" | "department" | "job_title">>();
  const assessments=await db.prepare('SELECT user_id,description,measurement_type,target,progress,completed_at,started_at FROM learning_assessments WHERE active=1').all<Pick<DatabaseRows["learning_assessments"], "user_id" | "description" | "measurement_type" | "target" | "progress" | "completed_at" | "started_at">>();
  return Response.json({people:people.results.map((p)=>{const courses=results.filter((c:CourseProgress)=>c.user_id===p.id).map(courseState);return {...p,courses,eligible:eligible(courses),overdue:courses.filter((c:CourseProgress&{learning_status:string})=>c.due_date&&c.due_date<localDate()&&c.learning_status!=='Completed').length,assessments:assessments.results.filter((a)=>a.user_id===p.id)};})},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}
