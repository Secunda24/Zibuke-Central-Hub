import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { NextRequest } from 'next/server';
import { context } from './server';
import { text, validDate } from './domain';

const fields:Record<string,{table:string;column:string}>={
  job_title:{table:'users',column:'job_title'},department:{table:'users',column:'department'},phone:{table:'users',column:'phone'},date_of_birth:{table:'users',column:'date_of_birth'},
  personal_email:{table:'employee_profiles',column:'personal_email'},alternate_phone:{table:'employee_profiles',column:'alternate_phone'},gender:{table:'employee_profiles',column:'gender'},start_date:{table:'employee_profiles',column:'start_date'},city:{table:'employee_profiles',column:'city'},province:{table:'employee_profiles',column:'province'},
};
function value(field:string, input:unknown) {
  const result=text(input,field,300);
  if(field.endsWith('email')&&!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(result)) throw new Response('Invalid email',{status:400});
  if(field.includes('phone')&&!/^\+27\d{9}$/.test(result)) throw new Response('Phone number requires manual correction',{status:400});
  if(['date_of_birth','start_date'].includes(field)) validDate(result);
  if(field==='date_of_birth'&&result>new Date().toISOString().slice(0,10)) throw new Response('Birthday is in the future',{status:400});
  return result;
}
export async function reconcileRequest(request:NextRequest) {
  const {db,actor}=await context(request);
  if(actor.role!=='admin') throw new Response('Forbidden',{status:403});
  const raw=await request.text();if(raw.length>1500000) throw new Response('Report is too large',{status:413});
  let body:{action:string;reviewed?:boolean;userId?:string;field?:string;proposed?:unknown;current?:string;report?:{rows:{source:string;name:string;user_id?:string;classification:string;issues?:unknown[];existing_name?:string;company_email?:string;fields_to_update?:{field:string;current:string;proposed:unknown}[]}[]}};try{body=JSON.parse(raw);}catch{throw new Response('Invalid report',{status:400});}
  if(body.action==='preview') {
    if(!Array.isArray(body.report?.rows)||body.report.rows.length>1000) throw new Response('Choose a reconciliation report',{status:400});
    const rows=[];
    for(const input of body.report.rows) {
      const row:{source:string;name:string;userId?:string;classification:string;issues:string[];changes:{field:string;current:string;proposed:string}[]}={source:text(input.source,'source',300),name:text(input.name,'name',300),userId:input.user_id,classification:input.classification,issues:Array.isArray(input.issues)?input.issues.map((v:unknown)=>text(v,'issue',2000)):[],changes:[]};
      if(input.classification!=='MATCHED'||!input.user_id) {row.issues.push('Manual identity review required; no updates available.');rows.push(row);continue;}
      const person=await db.prepare('SELECT u.id,u.email,u.first_name,u.last_name,u.job_title,u.department,u.phone,u.date_of_birth,p.personal_email,p.alternate_phone,p.gender,p.start_date,p.city,p.province FROM users u LEFT JOIN employee_profiles p ON p.user_id=u.id WHERE u.id=?').bind(input.user_id).first<Pick<DatabaseRows["users"], "id" | "email" | "first_name" | "last_name" | "job_title" | "department" | "phone" | "date_of_birth"> & Pick<DatabaseRows["employee_profiles"], "personal_email" | "alternate_phone" | "gender" | "start_date" | "city" | "province">>();
      const normal=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
      if(!person||normal(`${person.first_name} ${person.last_name}`)!==normal(input.existing_name||'')|| (input.company_email&&normal(input.company_email)!==normal(person.email))) {row.issues.push('Identity changed since dry run; regenerate the report.');rows.push(row);continue;}
      for(const change of Array.isArray(input.fields_to_update)?input.fields_to_update:[]) {
        if(!fields[change.field]) {row.issues.push(`${change.field}: use the existing private profile editor for manual review.`);continue;}
        try {
          const proposed=value(change.field,change.proposed),current=String(person[change.field as keyof typeof person]??'');
          if(current===proposed) continue;
          if(current!==String(change.current??'')) {row.issues.push(`${change.field}: changed since dry run; regenerate the report.`);continue;}
          row.changes.push({field:change.field,current,proposed});
        } catch {row.issues.push(`${change.field}: source value needs manual correction.`);}
      }
      rows.push(row);
    }
    return Response.json({rows},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action!=='apply'||body.reviewed!==true) throw new Response('Review the proposal before applying',{status:400});
  const userId=text(body.userId,'employee',100),field=text(body.field,'field',100),mapping=fields[field];
  if(!mapping) throw new Response('This field cannot be imported here',{status:400});
  const proposed=value(field,body.proposed),expected=text(body.current??'','previous value',300,true);
  if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(userId).first<Pick<DatabaseRows["users"], "id">>()) throw new Response('Employee not found',{status:404});
  const key=mapping.table==='users'?'id':'user_id';
  const current=await db.prepare(`SELECT ${mapping.column} value FROM ${mapping.table} WHERE ${key}=?`).bind(userId).first();
  if(String(current?.value??'')===proposed) return Response.json({ok:true,status:'Already applied'});
  if(String(current?.value??'')!==expected) throw new Response('This record changed since review. Refresh the dry run.',{status:409});
  const statements=[];
  if(mapping.table==='employee_profiles') statements.push(db.prepare('INSERT OR IGNORE INTO employee_profiles(user_id) VALUES(?)').bind(userId));
  statements.push(db.prepare(`UPDATE ${mapping.table} SET ${mapping.column}=? WHERE ${key}=? AND COALESCE(${mapping.column},'')=?`).bind(proposed,userId,expected));
  // No auth fields, role, identity number, relationship, progress or historical table can be changed by this path.
  statements.push(db.prepare('INSERT INTO learning_audit(id,actor_id,user_id,action,entity_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,userId,'profile_field_review',field));
  const result=await db.batch(statements);
  const update=result[mapping.table==='employee_profiles'?1:0];
  if(!update.meta.changes) throw new Response('Concurrent update detected. Refresh the dry run.',{status:409});
  return Response.json({ok:true,status:'Applied'});
}
