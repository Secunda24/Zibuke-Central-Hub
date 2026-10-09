export function text(value: unknown, label: string, max = 1000, optional = false): string {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max) throw new Response(`Invalid ${label}`, { status: 400 });
  return value.trim();
}
export function url(value: unknown, optional = false): string {
  const result = text(value ?? '', 'resource link', 2000, optional);
  if (!result && optional) return '';
  try { if (new URL(result).protocol === 'https:') return result; } catch {}
  throw new Response('Use an HTTPS link', { status: 400 });
}
export function days(value: unknown): number[] {
  if (!Array.isArray(value) || value.some(v => !Number.isInteger(v) || v < 0 || v > 6)) throw new Response('Invalid reporting weekdays', { status: 400 });
  return [...new Set(value)].sort();
}
export function measurement(type: unknown, target: unknown) {
  if (type !== 'numeric' && type !== 'project') throw new Response('Invalid assessment type', { status: 400 });
  if (type === 'numeric' && (typeof target !== 'number' || !Number.isFinite(target) || target <= 0)) throw new Response('A positive target is required', { status: 400 });
  return { type, target: type === 'numeric' ? target as number : null };
}
export function eligible(courses: {required: number; total: number; completed: number; quizzes_required?: number; quizzes_passed?: number}[]) {
  return courses.every(c => !c.required || (c.total > 0 && c.completed >= c.total && (c.quizzes_passed || 0) >= (c.quizzes_required || 0)));
}
export type Question = { prompt: string; options: string[]; correct: number };
export function questions(value: unknown): Question[] {
  if(!Array.isArray(value)||!value.length||value.length>50) throw new Response('Add 1–50 questions',{status:400});
  return value.map(q=>{
    if(!q||!Array.isArray(q.options)||q.options.length<2||q.options.length>6||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length) throw new Response('Check quiz choices and correct answers',{status:400});
    return {prompt:text(q.prompt,'question',2000),options:q.options.map((v:unknown)=>text(v,'answer',1000)),correct:q.correct};
  });
}
export function grade(items: Question[], answers: unknown, passMark: number) {
  if(!Array.isArray(answers)||answers.length!==items.length||answers.some((v,i)=>!Number.isInteger(v)||v<0||v>=items[i].options.length)) throw new Response('Answer every question',{status:400});
  const correct=items.filter((q,i)=>q.correct===answers[i]).length;
  const score=correct*100/items.length;
  return {score,passed:score>=passMark};
}
export function localDate(now = new Date()) {
  return new Date(now.getTime() + 2 * 3600000).toISOString().slice(0, 10);
}
export function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new Response('Invalid date', {status:400});
  return value;
}
export function reportingStatus(weekdays: number[], since: string, submissions: {due_date: string; submitted_at: string}[], today = localDate()) {
  const start = since.slice(0,10), submitted = new Map(submissions.map(s => [s.due_date,s]));
  const missing: string[] = [];
  // Show the last 90 days; preserve older submissions in the history.
  const cutoff = new Date(`${today}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate()-90);
  for (let day = new Date(`${start > cutoff.toISOString().slice(0,10) ? start : cutoff.toISOString().slice(0,10)}T00:00:00Z`); day.toISOString().slice(0,10) < today; day.setUTCDate(day.getUTCDate()+1)) {
    const key = day.toISOString().slice(0,10);
    if (weekdays.includes(day.getUTCDay()) && !submitted.has(key)) missing.push(key);
  }
  let next: string | null = null;
  for (let offset=0; offset<8; offset++) {
    const day = new Date(`${today}T00:00:00Z`); day.setUTCDate(day.getUTCDate()+offset);
    const key=day.toISOString().slice(0,10);
    if (key >= start && weekdays.includes(day.getUTCDay()) && !submitted.has(key)) {next=key;break;}
  }
  return { missing, next, timezone:'Africa/Johannesburg', late:submissions.filter(s => localDate(new Date(`${s.submitted_at.replace(' ','T')}Z`)) > s.due_date).map(s=>s.due_date) };
}
