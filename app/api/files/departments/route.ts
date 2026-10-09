import {getCloudflareContext} from '@opennextjs/cloudflare';
import {NextRequest, NextResponse} from 'next/server';
import {verifySession} from '@/src/modules/auth/session';
export const runtime = 'nodejs';
async function save(request: NextRequest, rename: boolean) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const {env} = await getCloudflareContext({async:true});
  const user = await env.DB.prepare('SELECT role FROM users WHERE id=?').bind(session.userId).first<{role:string}>();
  if (user?.role !== 'admin') return NextResponse.json({error:'Only administrators can manage departments.'}, {status:403});
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/ +/g,' ') : '';
  if (!name || name.length > 150 || /[\x00-\x1f\x7f]/.test(name)) return NextResponse.json({error:'Enter a department name of 1-150 characters without control characters.'}, {status:400});
  const id = rename ? body?.id : name;
  if (typeof id !== 'string' || !id || id.length > 150) return NextResponse.json({error:'Choose a department.'}, {status:400});
  try {
    if (rename && !await env.DB.prepare('SELECT id FROM file_departments WHERE id=?').bind(id).first()) return NextResponse.json({error:'Department not found.'}, {status:404});
    const result = rename
      ? await env.DB.prepare('UPDATE file_departments SET name=? WHERE id=?').bind(name,id).run()
      : await env.DB.prepare('INSERT INTO file_departments(id,name) VALUES(?,?)').bind(id,name).run();
    if (rename && !result.meta.changes) return NextResponse.json({error:'Department not found.'}, {status:404});
    return NextResponse.json({success:true, department:{id,name}}, {status:rename?200:201});
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) return NextResponse.json({error:'That department name already exists or is reserved by an existing folder.'}, {status:409});
    console.error('Department update failed',error);
    return NextResponse.json({error:'Unable to save the department. Please try again.'}, {status:500});
  }
}
export const POST = (request: NextRequest) => save(request,false);
export const PATCH = (request: NextRequest) => save(request,true);
