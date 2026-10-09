import {NextRequest} from 'next/server';
import {context,failure} from '@/src/modules/training/server';
import {courseProgressSql} from '@/src/modules/training/queries';
export async function POST(request:NextRequest){
 try{
  const {db,actor}=await context(request);if(actor.role!=='admin')return Response.json({error:'Only administrators can confirm qualification.'},{status:403});
  const body=await request.json().catch(()=>null);
  if(typeof body?.userId!=='string'||typeof body?.evidence!=='string'||!body.evidence.trim()||body.evidence.length>4000)return Response.json({error:'Select an intern and record qualification evidence.'},{status:400});
  const record=await db.prepare('SELECT status FROM employee_internships WHERE user_id=?').bind(body.userId).first<{status:string}>();
  if(!record)return Response.json({error:'Internship not found.'},{status:404});
  if(record.status==='qualified')return Response.json({error:'Qualification is already recorded.'},{status:409});
  // Atomic eligibility check and status update; the trigger retains the review history.
  const result=await db.prepare(`UPDATE employee_internships SET status='qualified',qualified_at=datetime('now'),qualified_by=?,qualification_evidence=?
   WHERE user_id=? AND status='active'
   AND EXISTS(SELECT 1 FROM learning_assessments WHERE user_id=? AND active=1)
   AND NOT EXISTS(SELECT 1 FROM learning_assessments WHERE user_id=? AND active=1 AND completed_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM (${courseProgressSql}) progress WHERE user_id=? AND required=1 AND (total=0 OR completed<total OR quizzes_passed<quizzes_required))`).bind(actor.id,body.evidence.trim(),body.userId,body.userId,body.userId,body.userId).run();
  if(!result.meta.changes)return Response.json({error:'Configure and complete the intern assessment requirements and all compulsory training before confirming qualification.'},{status:409});
  return Response.json({success:true});
 }catch(error){return failure(error);}
}
