import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import {getCloudflareContext} from '@opennextjs/cloudflare';
import {NextRequest} from 'next/server';
import {verifySession} from '@/src/modules/auth/session';
import {downloadHeaders} from '@/src/modules/backend/access';
export async function GET(request:NextRequest,{params}:{params:Promise<{path:string[]}>}) {
  const session=await verifySession(request.cookies);if(!session)return new Response('Unauthorized',{status:401});
  const {env}=await getCloudflareContext({async:true});const db=env.DB;
  const path=(await params).path;
  if(!Array.isArray(path)||path.length<2||path.some(p=>p==='..'||p==='.'||p.includes('\\')))return new Response('Invalid path',{status:400});
  const objectKey=path.join('/');
  const file=await db.prepare(`SELECT f.filename FROM files f JOIN users u ON u.id=? WHERE f.file_path=? AND (f.department='General' OR f.department=u.department OR u.department='Executive' OR u.role='admin')`).bind(session.userId,`/api/storage/${objectKey}`).first<Pick<DatabaseRows["files"], "filename">>();
  if(!file)return new Response('File not found',{status:404});
  const object=await env.COLLAB_BUCKET.get(objectKey);if(!object)return new Response('File not found',{status:404});
  return new Response(object.body as unknown as BodyInit,{headers:downloadHeaders(file.filename,object.httpMetadata?.contentType||'application/octet-stream')});
}
