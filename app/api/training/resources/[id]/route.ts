import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import {NextRequest} from 'next/server';
import {context,failure} from '@/src/modules/training/server';
import {downloadHeaders} from '@/src/modules/backend/access';
import {getCloudflareContext} from '@opennextjs/cloudflare';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 try {
  const {db,actor}=await context(request),{id}=await params;
  const lesson=await db.prepare('SELECT * FROM learning_lessons WHERE id=?').bind(id).first<Pick<DatabaseRows["learning_lessons"], "id" | "course_id" | "section_id" | "title" | "content" | "resource_url" | "sort_order" | "kind" | "required" | "duration_minutes" | "storage_key" | "content_type">>();
  if(!lesson||!lesson.storage_key)throw new Response('Resource not found',{status:404});
  if(actor.role!=='admin'&&!await db.prepare('SELECT 1 FROM learning_assignments WHERE user_id=? AND course_id=?').bind(actor.id,lesson.course_id).first<{"1":string}>())throw new Response('Resource not found',{status:404});
  const {env}=await getCloudflareContext({async:true});const object=await env.COLLAB_BUCKET.get(lesson.storage_key);
  if(!object)throw new Response('Resource not found',{status:404});
  return new Response(object.body as unknown as BodyInit,{headers:downloadHeaders(lesson.title,lesson.content_type||"application/octet-stream")});
 } catch(error){return failure(error);}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 try {
  const {db,actor}=await context(request);if(actor.role!=='admin')throw new Response('Forbidden',{status:403});
  const {id}=await params;
  const lesson=await db.prepare('SELECT l.*,c.status FROM learning_lessons l JOIN learning_courses c ON c.id=l.course_id WHERE l.id=?').bind(id).first<Pick<DatabaseRows["learning_lessons"], "id" | "course_id" | "section_id" | "title" | "content" | "resource_url" | "sort_order" | "kind" | "required" | "duration_minutes" | "storage_key" | "content_type"> & Pick<DatabaseRows["learning_courses"], "status">>();
  if(!lesson||lesson.status!=='draft')throw new Response('Upload resources before publishing the course',{status:409});
  const file=(await request.formData()).get('file');
  if(!(file instanceof File)||!file.size||file.size>25*1024*1024)throw new Response('Choose a PDF or MP4 up to 25 MB',{status:400});
  const bytes=new Uint8Array(await file.arrayBuffer());const ascii=(a:number,b:number)=>String.fromCharCode(...bytes.slice(a,b));
  const type=ascii(0,5)==='%PDF-'?'application/pdf':ascii(4,8)==='ftyp'?'video/mp4':null;
  if(!type)throw new Response('Choose a PDF or MP4',{status:400});
  const {env}=await getCloudflareContext({async:true}),bucket=env.COLLAB_BUCKET,key=`training/${id}/${crypto.randomUUID()}`;
  await bucket.put(key,bytes,{httpMetadata:{contentType:type}});
  try {
   const result=await db.prepare("UPDATE learning_lessons SET storage_key=?,content_type=?,kind=? WHERE id=? AND EXISTS(SELECT 1 FROM learning_courses c WHERE c.id=learning_lessons.course_id AND c.status='draft')").bind(key,type,type==='application/pdf'?'document':'video',id).run();
   if(!result.meta.changes)throw new Response('The course was published during upload; retry with a draft',{status:409});
  } catch(error){await bucket.delete(key);throw error;}
  return Response.json({ok:true});
 }catch(error){return failure(error);}
}
