// Run from the repository root after placing the workbook in the ignored import folder.
// Reads the raw .xlsx directly (ExcelJS) so cell font colour is available: any row whose NAME
// cell(s) are formatted red is treated as terminated and excluded from the import entirely.
// Column mapping is keyed by sheet NAME, never by spreadsheet order. "Business Developers" is
// split across Group 1 and Group 2, which share the same layout; Group 2 is matched explicitly.
// A name prefixed "(I)" (or any row on the People & Systems Interns sheet) is an intern and is
// persisted to employee_internships as status 'active' until an admin records qualification.
// Department routing: Business Developers / Signaling Managers / Signaling Accounts Executives go
// to "Zibuke Africa"; everyone else stays on "Zibuke OnCall".
// Existing users are matched by login email and updated in place (department/job title/phone/DOB);
// their passwords are never reset. Only genuinely new emails are inserted and given a temp password.
// Usage: node apps/angel-core/scripts/prepare-employee-import.mjs [workbook.xlsx] [existingJson]
import fs from 'node:fs';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

const dir = '.employee-import';
const read = file => JSON.parse(fs.readFileSync(fs.existsSync(file) ? file : `${dir}/${file}`, 'utf8').replace(/^\uFEFF/, ''));
const workbookPath = process.argv[2] || `${dir}/latest-candidates.xlsx`;
const existingRaw = read(process.argv[3] || 'latest-existing.json');
const existing = Array.isArray(existingRaw[0]?.results) ? existingRaw[0].results : existingRaw;

// Column letters per layout, mapped by the workbook's own sheet names below.
const layouts = {
  salesDevelopers: { name: 'C', gender: 'D', identity: 'E', dob: 'F', personal: 'G', phone: 'H', company: 'I', start: 'J' },
  interns: { name: 'C', gender: 'D', identity: 'E', personal: 'F', phone: 'G', company: 'H', start: 'L' },
  signalingManagers: { name: ['D', 'E'], gender: 'F', identity: 'G', personal: 'H', phone: 'I', company: 'J', start: 'N' },
  signalingAccountsExecutives: { name: 'D', identity: 'E', personal: 'F', phone: 'G', company: 'H', start: 'M' },
  communityRelationsManagers: { name: 'C', gender: 'D', identity: 'E', personal: 'F', phone: 'G', city: 'H', province: 'I', company: 'J', start: 'K' },
  contentCreators: { name: 'C', gender: 'E', identity: 'F', personal: 'G', phone: 'H', company: 'I', start: 'J' },
};
const sheets = [
  { name: 'Sales Managers', layout: 'salesDevelopers', jobTitle: 'Sales Manager' },
  { name: 'People & Systems Interns', layout: 'interns', jobTitle: 'People & Systems Intern', intern: true },
  { name: 'Signaling Managers', layout: 'signalingManagers', jobTitle: 'Signaling Manager' },
  { name: 'Signaling Accounts Executives', layout: 'signalingAccountsExecutives', jobTitle: 'Signaling Accounts Executive' },
  { name: 'Signaling Accounts Executives A', layout: 'signalingAccountsExecutives', jobTitle: 'Signaling Accounts Executive' },
  { name: 'Business Developers Group 2', layout: 'salesDevelopers', jobTitle: 'Business Developer' },
  { name: 'Business Developers Group 1', layout: 'salesDevelopers', jobTitle: 'Business Developer' },
  { name: 'Community Relations Managers', layout: 'communityRelationsManagers', jobTitle: 'Community Relations Manager' },
  { name: 'Content Creators', layout: 'contentCreators', jobTitle: 'Content Creator' },
];
const normalizeSheet = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const definitionFor = sheetName => sheets.find(s => normalizeSheet(s.name) === normalizeSheet(sheetName));
// Management mapping: the sheet's role -> the Zibuke Central division (the same three values the
// People page tabs, the Calendar department filter and the Announcement audience picker use).
const DIVISION_BY_TITLE = {
  'Sales Manager': 'Zibuke OnCall',
  'Sales Representative': 'Zibuke OnCall',
  'Signaling Manager': 'Zibuke Africa Sales',
  'Signaling Accounts Executive': 'Zibuke Africa Sales',
  'Business Developer': 'Zibuke Africa Sales',
  'People & Systems Intern': 'Zibuke Africa Office',
  'Community Relations Manager': 'Zibuke Africa Office',
  'Software Developer': 'Zibuke Africa Office',
  'Content Creator': 'Zibuke Africa Office',
};
// The company email domain is authoritative for the two company domains; the sheet role then picks
// the division within Zibuke Africa (Sales vs Office), so all three divisions stay in use.
const departmentFor = (address, jobTitle) => { const a = String(address || '').trim().toLowerCase(); if (a.endsWith('@zibukeoncall.co.za')) return 'Zibuke OnCall'; if (a.endsWith('@zibukeafrica.co.za')) return DIVISION_BY_TITLE[jobTitle] || 'Zibuke Africa Office'; return DIVISION_BY_TITLE[jobTitle] || 'Zibuke OnCall'; };
// Administrator rights (public job title unchanged): People & Systems Interns, plus the named intern.
const ADMIN_EMAILS = new Set(['zimasasomtsewu@zibukeafrica.co.za']);
const roleFor = (address, jobTitle) => (jobTitle === 'People & Systems Intern' || ADMIN_EMAILS.has(String(address || '').trim().toLowerCase())) ? 'admin' : 'employee';

const pending = [], records = [], credentials = [], issues = [], duplicates = [], conflicts = [], terminated = [], unmappedSheets = [];
// A cell may hold several addresses (e.g. "name@x\njobs@x"); keep the first and drop separators.
const email = v => (String(v || '').split(/[\r\n;,]+/).map(part => part.trim()).filter(Boolean)[0] || '').toLowerCase().replace(/,$/, '').replace(/\s/g, '');
const cleanName = v => (v || '').replace(/^\(I\)\s*/, '').replace(/\s+/g, ' ').trim();
const key = v => cleanName(v).toLowerCase();
const date = v => {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const raw = String(v).trim();
  if (!raw || /^N\/A$/i.test(raw)) return '';
  if (/^\d+$/.test(raw)) return new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000).toISOString().slice(0, 10);
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const phone = v => {
  let n = (v || '').replace(/[^\d+]/g, '');
  if (/^\d{9}$/.test(n)) n = '0' + n;
  return /^0\d{9}$/.test(n) ? '+27' + n.slice(1) : n;
};
const columnLetter = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
const textOf = value => {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('');
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return String(value.result ?? '');
    if ('formula' in value) return '';
    return String(value);
  }
  return String(value).trim();
};
const RED_INDEXED = new Set([2, 10]);
const isRed = color => {
  if (!color) return false;
  if (typeof color.indexed === 'number' && RED_INDEXED.has(color.indexed)) return true;
  const argb = color.argb || color.rgb;
  if (argb) {
    const hex = String(argb).length === 8 ? String(argb).slice(2) : String(argb);
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].every(Number.isFinite) && r >= 0xb0 && g <= 0x60 && b <= 0x60) return true;
  }
  return false;
};
const cellIsRed = cell => isRed(cell.font?.color) || (Array.isArray(cell.value?.richText) && cell.value.richText.some(run => isRed(run.font?.color)));
const pick = (c, layout) => Object.fromEntries(Object.entries(layout).map(([field, spec]) => [field, Array.isArray(spec) ? spec.map(col => c[col] || '').join(' ').trim() : (c[spec] || '')]));
const duplicateOf = rec => records.find(r =>
  (r.email && r.email === rec.email) ||
  (rec.identity_number && r.identity_number === rec.identity_number) ||
  (key(r.name) === key(rec.name) && r.personal_email && r.personal_email === rec.personal_email) ||
  // Fallback: the same full name (case-insensitive) is treated as the same person even when the
  // email spelling differs (e.g. abrahammbombi vs abrahammbambo), so we never insert a duplicate.
  key(r.name) === key(rec.name));

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(workbookPath);

for (const [index, worksheet] of workbook.worksheets.entries()) {
  const definition = definitionFor(worksheet.name);
  if (!definition) { unmappedSheets.push(worksheet.name); continue; }
  const layout = layouts[definition.layout];
  const nameColumns = Array.isArray(layout.name) ? layout.name : [layout.name];
  for (let rowNumber = 5; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const loc = `sheet${index + 1}:${rowNumber}`;
    const c = {};
    row.eachCell({ includeEmpty: false }, cell => { c[columnLetter(cell.col)] = textOf(cell.value); });
    const col = pick(c, layout);
    if (!col.personal && !col.company && !col.name) continue;
    if (nameColumns.some(letter => cellIsRed(row.getCell(letter)))) { terminated.push({ source: loc, name: col.name || '', email: email(col.company || col.personal) }); continue; }
    if (!col.personal && !col.company) continue;
    if (!col.name || Object.values(c).includes('Resigned')) {
      const repeated = records.find(r => r.email === email(col.company || col.personal) || (r.personal_email && r.personal_email === email(col.personal || col.company)));
      if (repeated && !col.name) { duplicates.push({ source: loc, mergedInto: repeated.source[0], reason: 'Unnamed row repeats a candidate email already in the workbook' }); continue; }
      pending.push({ source: loc, name: col.name || '', email: email(col.personal || col.company), reason: col.name ? 'Marked resigned' : 'Missing name' });
      continue;
    }
    const p = (col.phone || '').split('/').map(phone);
    const rec = { name: cleanName(col.name), email: email(col.company || col.personal), personal_email: email(col.personal), phone: p[0], alternate_phone: p.slice(1).join(' / '), identity_number: col.identity || '', gender: col.gender || '', date_of_birth: date(col.dob), start_date: date(col.start), city: col.city || '', province: col.province || '', job_title: definition.jobTitle, department: departmentFor(email(col.company || col.personal), definition.jobTitle), is_intern: Boolean(definition.intern) || /^\(I\)\s*/i.test(col.name), source: [loc] };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rec.email)) throw Error(`Invalid email ${loc}`);
    if (rec.date_of_birth > new Date().toISOString().slice(0, 10)) { issues.push({ source: loc, field: 'date_of_birth', reason: 'Future birthday omitted', value: rec.date_of_birth }); rec.date_of_birth = ''; }
    if (rec.identity_number && rec.identity_number.length !== 13) issues.push({ source: loc, field: 'identity_number', reason: 'Preserved as supplied; length requires review' });
    if (rec.phone && !/^\+27\d{9}$/.test(rec.phone)) issues.push({ source: loc, field: 'phone', reason: 'Preserved as supplied; format requires review' });
    const duplicate = duplicateOf(rec);
    if (duplicate) {
      const matchedByContact = duplicate.email === rec.email || (rec.identity_number && duplicate.identity_number === rec.identity_number) || (duplicate.personal_email && duplicate.personal_email === rec.personal_email);
      const reason = duplicate.email === rec.email ? 'Duplicate login email' : (rec.identity_number && duplicate.identity_number === rec.identity_number ? 'Duplicate identity number' : matchedByContact ? 'Duplicate name and personal email' : 'Same full name with a different email spelling');
      if (!matchedByContact) conflicts.push({ type: 'name_only_merge', name: rec.name, entries: [{ source: duplicate.source[0], email: duplicate.email, identity_number: duplicate.identity_number }, { source: loc, email: rec.email, identity_number: rec.identity_number }], resolution: 'Same full name but different contact details; merged into the first record — verify these are the same person' });
      duplicates.push({ source: loc, mergedInto: duplicate.source[0], reason });
      for (const [field, value] of Object.entries(rec)) if (!duplicate[field] && value) duplicate[field] = value;
      duplicate.is_intern = duplicate.is_intern || rec.is_intern;
      duplicate.source.push(loc);
      continue;
    }
    records.push(rec);
  }
}

const byName = new Map(), byPersonal = new Map();
for (const r of records) {
  const nk = key(r.name);
  if (!byName.has(nk)) byName.set(nk, []);
  byName.get(nk).push(r);
  if (r.personal_email) {
    if (!byPersonal.has(r.personal_email)) byPersonal.set(r.personal_email, []);
    byPersonal.get(r.personal_email).push(r);
  }
}
for (const group of byName.values()) if (group.length > 1) conflicts.push({ type: 'duplicate_name', name: group[0].name, entries: group.map(r => ({ source: r.source[0], identity_number: r.identity_number, email: r.email })), resolution: 'Not merged: entries carry different identity numbers; confirm whether these are the same person' });
for (const [address, group] of byPersonal) if (new Set(group.map(r => key(r.name))).size > 1) conflicts.push({ type: 'shared_personal_email', email: address, names: [...new Set(group.map(r => r.name))], resolution: 'Not merged: shared mailbox across different people; distinct logins retained' });

const idNumbers = records.filter(r => /^\d{13}$/.test(r.identity_number)).map(r => r.identity_number);
if (new Set(records.map(r => r.email)).size !== records.length) throw Error('Duplicate login emails remain after duplicate resolution');
if (new Set(idNumbers).size !== idNumbers.length) throw Error('Duplicate identity numbers remain after duplicate resolution');

const sql = [
  fs.readFileSync('apps/angel-core/migrations/005_employee_profiles.sql', 'utf8'),
  fs.readFileSync('apps/angel-core/migrations/010_employee_internships.sql', 'utf8'),
];
const q = v => v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const byEmail = new Map(existing.filter(u => u && u.email).map(u => [email(u.email), u]));
const existingByName = new Map(existing.filter(u => u && (u.first_name || u.last_name)).map(u => [key(`${u.first_name || ''} ${u.last_name || ''}`), u]));
// Red/terminated people who already exist in the database are removed entirely.
const terminatedRemoved = terminated.map(t => t.email).filter(e => e && byEmail.has(e));
if (terminatedRemoved.length) sql.push(`DELETE FROM users WHERE email IN (${terminatedRemoved.map(q).join(',')});`);
const newJoiners = [];
for (const r of records) {
  const old = byEmail.get(r.email) || existingByName.get(key(r.name));
  if (old && email(old.email) !== r.email) duplicates.push({ source: r.source[0], mergedInto: `existing:${old.email}`, reason: 'Matched an existing account by full name (email spelling differs) — updated instead of inserting a duplicate' });
  r.id = old?.id || crypto.randomUUID();
  const [first, ...last] = r.name.split(' ');
  if (old) {
    sql.push(`UPDATE users SET department=${q(r.department)}, job_title=${q(r.job_title)}, phone=COALESCE(${q(r.phone)},phone), date_of_birth=COALESCE(${q(r.date_of_birth)},date_of_birth), updated_at=datetime('now') WHERE id=${q(r.id)};`);
  } else {
    const password = crypto.randomBytes(18).toString('base64url'), salt = crypto.randomBytes(16).toString('hex'), iterations = 100000;
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha256').toString('hex');
    sql.push(`INSERT INTO users (id,email,first_name,last_name,role,department,job_title,phone,date_of_birth,id_document_path,password_hash,password_salt,password_iterations) VALUES (${q(r.id)},${q(r.email)},${q(first)},'${last.join(' ').replace(/'/g, "''")}',${q(roleFor(r.email, r.job_title))},${q(r.department)},${q(r.job_title)},${q(r.phone)},${q(r.date_of_birth)},'',${q(hash)},${q(salt)},${iterations}) ON CONFLICT(email) DO UPDATE SET department=excluded.department, job_title=excluded.job_title, role=CASE WHEN users.role='admin' THEN users.role ELSE excluded.role END, phone=COALESCE(excluded.phone,users.phone), date_of_birth=COALESCE(excluded.date_of_birth,users.date_of_birth), updated_at=datetime('now');`);
    credentials.push({ name: r.name, email: r.email, temporary_password: password });
    newJoiners.push(r.email);
  }
  const fields = ['personal_email', 'alternate_phone', 'identity_number', 'gender', 'city', 'province', 'start_date'];
  sql.push(`INSERT INTO employee_profiles (user_id,${fields.join(',')}) VALUES (${q(r.id)},${fields.map(f => q(r[f])).join(',')}) ON CONFLICT(user_id) DO UPDATE SET ${fields.map(f => `${f}=COALESCE(excluded.${f},employee_profiles.${f})`).join(',')},updated_at=datetime('now');`);
  if (r.is_intern) sql.push(`INSERT INTO employee_internships (user_id,status,started_at,source_reference) VALUES (${q(r.id)},'active',${q(r.start_date)},${q(r.source[0])}) ON CONFLICT(user_id) DO UPDATE SET started_at=COALESCE(excluded.started_at,employee_internships.started_at),source_reference=excluded.source_reference,imported_at=datetime('now') WHERE employee_internships.status='active';`);
}
fs.writeFileSync(`${dir}/import.sql`, sql.join('\n'));
fs.writeFileSync(`${dir}/records.json`, JSON.stringify(records, null, 2));
fs.writeFileSync(`${dir}/review.json`, JSON.stringify({ pending, issues, duplicates, conflicts, terminated, terminatedRemoved, interns: records.filter(r => r.is_intern).map(r => ({ name: r.name, email: r.email, start_date: r.start_date, source: r.source[0] })), newEmployees: newJoiners, unmappedSheets }, null, 2));
fs.writeFileSync(`${dir}/credentials.json`, JSON.stringify(credentials, null, 2));
console.log(JSON.stringify({ employees: records.length, newAccounts: credentials.length, existingAccounts: records.length - credentials.length, interns: records.filter(r => r.is_intern).length, terminatedExcluded: terminated.length, terminatedRemoved: terminatedRemoved.length, pending: pending.length, issues: issues.length, duplicatesResolved: duplicates.length, conflicts: conflicts.length, unmappedSheets, departments: records.reduce((a, r) => (a[r.department] = (a[r.department] || 0) + 1, a), {}), jobTitles: records.reduce((a, r) => (a[r.job_title] = (a[r.job_title] || 0) + 1, a), {}) }));
