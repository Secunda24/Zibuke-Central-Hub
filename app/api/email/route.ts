import type {DatabaseRows} from "@/src/modules/backend/database-rows";
﻿import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { verifySession } from '@/src/modules/auth/session';
export async function POST(request:NextRequest) {
  const session=await verifySession(request.cookies);
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const {env}=await getCloudflareContext({async:true});const config=env;const db=config.DB;
    const user=await db.prepare('SELECT email FROM users WHERE id=?').bind(session.userId).first<Pick<DatabaseRows["users"], "email">>();
    if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    if(!config.RESEND_API_KEY||!config.OTP_EMAIL_FROM)return NextResponse.json({error:'Email delivery is not configured'},{status:503});
    const now=Math.floor(Date.now()/1000),key=`email-test:${session.userId}`;
    const limit=await db.prepare(`INSERT INTO request_limits(key,window_start,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1 WHERE request_limits.window_start<=?`).bind(key,now,now-60).run();
    if(!limit.meta.changes)return NextResponse.json({error:'Wait one minute before sending another test'},{status:429});
    const result=await new Resend(config.RESEND_API_KEY).emails.send({from:config.OTP_EMAIL_FROM,to:user.email,subject:'Zibuke Central email test',text:'This is the email test you requested from your Zibuke Central account settings.'});
    if(result.error){console.error('Resend rejected the test email',result.error);return NextResponse.json({error:'Email provider rejected delivery. Ask an administrator to check the verified sender domain.',detail:String(result.error.message||result.error.name||'').slice(0,300)},{status:502});}
    return NextResponse.json({success:true});
  } catch {return NextResponse.json({error:'Could not send the email test'},{status:503});}
}
