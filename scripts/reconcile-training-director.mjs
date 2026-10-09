// Read-only reconciliation. Inputs and reports remain in the ignored .employee-import directory.
// This script intentionally has no database write or account creation path.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const nameKey = value => String(value || '').replace(/^\(I\)\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
export const emailKey = value => String(value || '').trim().toLowerCase();
export function phoneKey(value) {
  let phone = String(value || '').replace(/[^\d+]/g, '');
  if (/^\d{9}$/.test(phone)) phone = `0${phone}`;
  if (/^0\d{9}$/.test(phone)) phone = `+27${phone.slice(1)}`;
  if (/^27\d{9}$/.test(phone)) phone = `+${phone}`;
  return phone;
}
const phones = value => String(value || '').split('/').map(phoneKey).filter(Boolean);
const titleBySheet = ['Sales Manager', 'People & Systems Intern', 'Signaling Manager', 'Signaling Accounts Executive', 'Signaling Accounts Executive', 'Business Developer', 'Community Relations Manager', 'Content Creator'];
const date = value => {
  if (!value || value === 'N/A') return '';
  if (/^\d+$/.test(value)) return new Date(Date.UTC(1899,11,30) + Number(value)*86400000).toISOString().slice(0,10);
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!parts) return '';
  const iso = `${parts[3]}-${parts[2]}-${parts[1]}`;
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10) === iso ? iso : '';
};
const notBlank = value => value !== '' && value !== undefined && value !== null && value !== 'N/A';

export function matchPerson(person, users) {
  const strategies = [
    ['Existing user ID exact', user => person.user_id && user.id === person.user_id],
    ['Company email exact', user => person.company_email && emailKey(user.email) === emailKey(person.company_email)],
    ['Personal email exact', user => person.personal_email && [user.personal_email,user.email].some(v => emailKey(v) === emailKey(person.personal_email))],
    ['Phone exact', user => phones(person.phone).some(p => [...phones(user.phone),...phones(user.alternate_phone)].includes(p))],
    ['Full name exact', user => person.name && nameKey(`${user.first_name || ''} ${user.last_name || ''}`) === nameKey(person.name)],
  ];
  for (const [method, predicate] of strategies) {
    const matches = users.filter(predicate);
    if (!matches.length) continue;
    if (matches.length > 1) return { method, status: 'CONFLICT', candidates: matches.map(u => u.id) };
    const user = matches[0];
    // A name/contact conflict requires review even if one contact is an exact match.
    const conflictingName = person.name && nameKey(`${user.first_name || ''} ${user.last_name || ''}`) !== nameKey(person.name);
    const conflictingCompany = person.company_email && emailKey(user.email) !== emailKey(person.company_email);
    return { method, status: conflictingName || conflictingCompany ? 'PROBABLE MATCH — REVIEW REQUIRED' : 'MATCHED', user };
  }
  return { method: 'No unique exact contact/name match', status: 'UNMATCHED' };
}

function extract(sheets) {
  const records = [], excluded = [];
  for (const [index,sheet] of sheets.entries()) {
    let manager = '', group = '', meeting = '';
    for (const source of sheet.rows.filter(row => row.row >= 5)) {
      const c = Object.fromEntries(Object.entries(source.cells).map(([k,v]) => [k,v.value.trim()]));
      if ([3,4].includes(index) && c.B) {
        manager = c.B.split(/\s*-\s*Group/i)[0].trim();
        group = c.B.match(/Group\s*[\w]+/i)?.[0] || '';
        meeting = c.C || '';
      }
      const r = { source: `${sheet.name}!${source.row}`, sheet: sheet.name, row: source.row, job_title: titleBySheet[index], name: '', company_email: '', personal_email: '', phone: '', issues: [] };
      if ([0,5,7].includes(index)) Object.assign(r,{name:c.C,personal_email:c.G,company_email:c.I,phone:c.H,identity_number:c[index===7?'F':'E'],gender:c[index===7?'E':'D'],date_of_birth:index===7?'':date(c.F),start_date:date(c.J)});
      if ([1,6].includes(index)) Object.assign(r,{name:c.C,personal_email:c.F,company_email:c[index===1?'H':'J'],phone:c.G,identity_number:c.E,gender:c.D,start_date:date(c[index===1?'L':'K'])});
      if (index===2) Object.assign(r,{name:`${c.D||''} ${c.E||''}`,personal_email:c.H,company_email:c.J,phone:c.I,identity_number:c.G,gender:c.F,start_date:date(c.N),group:c.B,territory:c.C,qualification:c.K,institution:c.L,logbook_progress:c.M,end_date:date(c.O),notes:c.P});
      if ([3,4].includes(index)) Object.assign(r,{name:c.D,personal_email:c.F,company_email:c.H,phone:c.G,identity_number:c.E,start_date:date(c.M),qualification:c.I,institution:c.J,logbook_progress:c.K,internship_end_date:date(c.L),end_date:date(c.O),aa_progress:c.N,notes:c.P,manager,group,meeting});
      if (index===0) Object.assign(r,{portal_access_date:date(c.K),end_date:date(c.L),aa_progress:c.M,aa_measurement:'points',aa_target:540,notes:c.N});
      if (index===1) Object.assign(r,{group:c.B,qualification:c.I,institution:c.J,logbook_progress:c.K,aa_requirement:c.M,end_date:date(c.N),notes:c.O});
      if (index===5) Object.assign(r,{end_date:date(c.K),aa_progress:c.L,aa_measurement:'companies signed',notes:c.M});
      if (index===6) Object.assign(r,{city:c.H,province:c.I,end_date:date(c.L),aa_progress:c.M,aa_measurement:'companies signed',notes:c.N});
      if (index===7) Object.assign(r,{source_division:c.B,end_date:date(c.M),aa_progress:c.L,aa_target:c.K,notes:c.N});
      if (!r.personal_email && !r.company_email && (!r.name || r.name.startsWith('See "'))) { excluded.push({source:r.source,reason:'Cross-reference / non-person row'}); continue; }
      r.name = String(r.name || '').replace(/^\(I\)\s*/i,'').replace(/\s+/g,' ').trim();
      r.company_email = emailKey(r.company_email); r.personal_email = emailKey(r.personal_email);
      // Do not silently repair invalid emails. The candidate is still matchable by other identifiers.
      for (const field of ['company_email','personal_email']) if (r[field] && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(r[field])) r.issues.push(`${field}: invalid source formatting; review required`);
      if (r.identity_number && !/^\d{13}$/.test(r.identity_number)) r.issues.push('ID number format requires review; original private value preserved');
      if (r.phone && phones(r.phone).some(p=>!/^\+27\d{9}$/.test(p))) r.issues.push('Phone format requires review');
      if (r.date_of_birth && r.date_of_birth > new Date().toISOString().slice(0,10)) { r.issues.push('Birthday is in the future; do not apply'); r.date_of_birth=''; }
      if (r.qualification && /college|campus|academy/i.test(r.qualification)) r.issues.push('Qualification/institution columns appear reversed; review before applying');
      if (r.internship_end_date && r.start_date && r.internship_end_date < r.start_date) r.issues.push('Internship end date precedes start date');
      if (r.end_date && r.start_date && (Date.parse(r.end_date)-Date.parse(r.start_date))/86400000 < 7) r.issues.push('Assessment date range is under seven days; confirm spreadsheet dates');
      if (r.notes === 'Resigned') r.issues.push('Marked resigned; retain prior decision to leave pending');
      if (!r.name) r.issues.push('No name supplied');
      records.push(r);
    }
  }
  return { records, excluded };
}

function positionPolicies(guidelines) {
  guidelines = Array.isArray(guidelines) ? guidelines : [guidelines];
  let division='';
  const canonical = {'People & Systems Inters':'People & Systems Intern','Software Developers':'Software Developer','Administrators':'Administrator','Community Relations Managers':'Community Relations Manager','Signaling Managers':'Signaling Manager','Signaling Accounts Executives':'Signaling Accounts Executive','Business Developers':'Business Developer','Sales Managers':'Sales Manager','Sales Representatives':'Sales Representative'};
  return guidelines.flatMap(sheet=>sheet.rows.filter(r=>r.row>=4).map(row=>{
    const c=Object.fromEntries(Object.entries(row.cells).map(([k,v])=>[k,v.value.trim()]));
    if(c.B) division=c.B.replace('Affrica','Africa');
    const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].filter(day=>c.G.includes(day));
    return {source:`${sheet.name}!${row.row}`,division,position:canonical[c.C]||c.C,position_type:c.D,access_requirements:c.E,assessment_requirement:c.F,report_interval:c.G,report_schedule:{frequency:weekdays.length?'weekly':'never',weekdays},schedule_note:/Bi-Weekly/i.test(c.G)?'Proposed twice-weekly interpretation based on explicitly listed days; confirm.':'',permissions_status:'Proposed only; no permissions applied'};
  }));
}

export function reconcile(sheets, guidelines, users) {
  const {records,excluded}=extract(sheets), policies=positionPolicies(guidelines), seen=new Map();
  const rows=records.map(record=>{
    const match=matchPerson(record,users), policy=policies.find(p=>p.position===record.job_title);
    const issues=[...record.issues], changes=[], same=[];
    const comparison={name:record.name,job_title:record.job_title,personal_email:record.personal_email,phone:phones(record.phone)[0],alternate_phone:phones(record.phone).slice(1).join(' / '),gender:record.gender,date_of_birth:record.date_of_birth,start_date:record.start_date,city:record.city,province:record.province};
    if(match.user){
      const current={...match.user,name:`${match.user.first_name||''} ${match.user.last_name||''}`.trim()};
      for(const [field,value] of Object.entries(comparison).filter(([,v])=>notBlank(v))){
        const norm=field.includes('email')?emailKey:field.includes('phone')?phoneKey:field==='name'?nameKey:v=>String(v||'').trim();
        if(norm(value)===norm(current[field])) same.push(field); else changes.push({field,current:current[field]||'',proposed:value});
      }
      if(record.identity_number) (record.identity_number===match.user.identity_number?same:changes).push(record.identity_number===match.user.identity_number?'identity_number':{field:'identity_number',current:match.user.identity_number?'[private value present]':'[not supplied]',proposed:'[private value supplied; validation required]'});
      if(record.company_email && record.company_email!==emailKey(match.user.email)) issues.push('Company email differs from existing login email; retain login identity pending review');
      if(policy && policy.division!==match.user.department) issues.push(`Division decision: current ${match.user.department}; guidelines propose ${policy.division}; conflicts with earlier all-OnCall instruction`);
      if(policy && policy.division!==match.user.department) changes.push({field:'department',current:match.user.department||'',proposed:policy.division});
    }
    if(record.source_division && policy && record.source_division!==policy.division) issues.push(`Candidate division '${record.source_division}' differs from guideline division '${policy.division}'`);
    if(record.job_title==='Sales Manager') issues.push('Candidate target uses points; guidelines describe sales units and reference assigned Signaling Account Executives although measurement says Sales Representatives');
    if(record.job_title==='Community Relations Manager') issues.push('Candidate progress column measures companies signed; guidelines require meetings with radio stations');
    if(record.personal_email){
      const peers=records.filter(r=>r!==record && r.personal_email===record.personal_email && r.name && record.name && nameKey(r.name)!==nameKey(record.name));
      if(peers.length) issues.push(`Personal email shared with another named source person: ${[...new Set(peers.map(r=>r.name))].join(', ')}; do not merge`);
    }
    const duplicateKey=match.user?.id || `${record.company_email}|${record.personal_email}|${nameKey(record.name)}`;
    const prior=seen.get(duplicateKey);
    let classification=match.status;
    if(prior){
      classification='DUPLICATE SOURCE RECORD';issues.push(`Also appears at ${prior.source}`);
      if(prior.manager && record.manager && nameKey(prior.manager)!==nameKey(record.manager)){
        issues.push(`Conflicting managers: ${prior.manager} / ${record.manager}; no relationship update`);
        prior.report.issues.push(`Duplicate ${record.source} supplies a different manager: ${record.manager}; no relationship update`);
      }
    }
    const extensions=Object.fromEntries(['group','territory','qualification','institution','logbook_progress','portal_access_date','end_date','internship_end_date','manager','meeting','aa_requirement','aa_measurement','aa_target','aa_progress','notes'].filter(f=>notBlank(record[f])).map(f=>[f,record[f]]));
    const row={source:record.source,name:record.name||'[Name missing]',company_email:record.company_email,personal_email:record.personal_email,classification,match_method:match.method,user_id:match.user?.id||null,existing_name:match.user?`${match.user.first_name||''} ${match.user.last_name||''}`.trim():null,candidate_user_ids:match.candidates||[],current_role:match.user?.role||null,current_division:match.user?.department||null,position:record.job_title,proposed_division:policy?.division||null,fields_to_update:changes,fields_already_matching:same,additional_candidate_fields:extensions,issues,apply_status:'NOT APPLIED'};
    if(!prior) seen.set(duplicateKey,{...record,report:row});
    return row;
  });
  const interns=policies.find(p=>p.position==='People & Systems Intern');
  const internRequirements=(interns?.assessment_requirement||'').split('\n').filter(line=>line.trim().startsWith('(I)')).map(line=>{
    const [name,...requirement]=line.split(' - ');const matches=rows.filter(r=>r.position==='People & Systems Intern'&&nameKey(r.name)===nameKey(name)&&r.classification==='MATCHED');
    return {name:name.replace(/^\(I\)\s*/,''),user_id:matches.length===1?matches[0].user_id:null,requirement:requirement.join(' - '),status:matches.length===1?'Resolved to existing user; assignment pending':'Review required'};
  });
  return {generated_at:new Date().toISOString(),mode:'DRY RUN — no database writes',summary:{source_person_rows:rows.length,existing_users:users.length,unique_matched_user_ids:new Set(rows.filter(r=>r.user_id).map(r=>r.user_id)).size,classifications:rows.reduce((a,r)=>(a[r.classification]=(a[r.classification]||0)+1,a),{}),rows_with_issues:rows.filter(r=>r.issues.length).length,profiles_updated:0,records_intentionally_not_changed:rows.length,position_assignments_updated:0,permission_mappings_applied:0,aa_requirements_assigned:0,reporting_schedules_assigned:0,training_assignments_created:0},excluded,policies,internRequirements,rows};
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(report){
  const unresolved=report.rows.filter(r=>r.classification!=='MATCHED'||r.issues.length);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Training Director reconciliation dry run</title><style>body{font:15px system-ui;margin:35px auto;max-width:1250px;padding:0 20px;color:#172536;background:#f7f9fc}h1{font-size:28px}h2{margin-top:32px}table{border-collapse:collapse;width:100%;font-size:13px;background:white}td,th{text-align:left;vertical-align:top;padding:10px;border:1px solid #dbe2ea;overflow-wrap:anywhere}th{background:#e8eef5}details{background:white;border:1px solid #dbe2ea;padding:12px;margin:8px 0}summary{cursor:pointer;font-weight:650}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#536275}.notice{background:#fff0cb;padding:16px;border-radius:8px}li{margin:6px 0}</style><h1>Training Director reconciliation</h1><p class="notice">Read-only dry run. No employees, permissions, assessments, training assignments or report schedules were changed. Full ID numbers and authentication credentials are excluded.</p><p>Prepared ${escape(report.generated_at)} against ${report.summary.existing_users} existing users.</p><h2>Counts</h2><pre>${escape(JSON.stringify(report.summary,null,2))}</pre><h2>Decisions needed</h2><ul><li>Division and access changes are proposals only. Existing access remains unchanged until explicitly approved.</li><li>Training uses configurable courses and quizzes. Assessment eligibility requires all compulsory lessons complete and required quizzes passed.</li><li>Resolve ambiguous matches, shared contact details, duplicate manager assignments and source-value issues below.</li><li>Confirm that “Bi-Weekly” plus two weekdays means twice per week.</li></ul><h2>Position requirements (${report.policies.length})</h2><table><tr><th>Position / division</th><th>Access requested</th><th>Assessment</th><th>Reporting</th></tr>${report.policies.map(p=>`<tr><td>${escape(p.position)}<br>${escape(p.division)}<br><small>${escape(p.position_type)}; ${escape(p.source)}</small></td><td><pre>${escape(p.access_requirements)}</pre></td><td><pre>${escape(p.assessment_requirement)}</pre></td><td>${escape(p.report_interval)}<br>${escape(p.schedule_note)}</td></tr>`).join('')}</table><h2>Individual intern requirements</h2>${report.internRequirements.map(i=>`<p><b>${escape(i.name)}</b> — ${escape(i.requirement)}<br><small>Existing user ID: ${escape(i.user_id||'UNRESOLVED')} · ${escape(i.status)}</small></p>`).join('')}<h2>Every unresolved record (${unresolved.length} source rows)</h2><table><tr><th>Person / source</th><th>Classification</th><th>Issues</th></tr>${unresolved.map(r=>`<tr><td>${escape(r.name)}<br>${escape(r.company_email||r.personal_email)}<br><small>${escape(r.source)}</small></td><td>${escape(r.classification)}</td><td>${escape(r.issues.join('; ')||r.match_method)}</td></tr>`).join('')}</table><h2>All source records (${report.rows.length})</h2>${report.rows.map(r=>`<details><summary>${escape(r.name)} — ${escape(r.classification)} — ${escape(r.source)}</summary><pre>${escape(JSON.stringify(r,null,2))}</pre></details>`).join('')}<h2>Excluded non-person rows</h2><pre>${escape(JSON.stringify(report.excluded,null,2))}</pre></html>`;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const directory=process.argv[2]||'.employee-import';
  const read=file=>JSON.parse(fs.readFileSync(`${directory}/${file}`,'utf8').replace(/^\uFEFF/,''));
  const report=reconcile(read('candidates-source.json'),read('guidelines-source.json'),read('reconciliation-database.json')[0].results);
  fs.writeFileSync(`${directory}/reconciliation-report.json`,JSON.stringify(report,null,2));
  fs.writeFileSync(`${directory}/reconciliation-report.html`,render(report));
  console.log(JSON.stringify(report.summary,null,2));
}
