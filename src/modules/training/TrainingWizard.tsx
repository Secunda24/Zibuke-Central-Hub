'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { Icon } from '@/src/modules/shared/Icons';

const control = 'mt-1 block w-full rounded-lg border border-gray-700 bg-[#0B1120] p-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]';
const primary = 'inline-flex items-center gap-2 rounded-lg bg-[#00DF73] px-5 py-2.5 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-500';
const ghost = 'inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-[#0B1120] disabled:opacity-50';
const fileInput = 'mt-1 block w-full text-xs text-gray-400 file:mr-3 file:rounded file:border-0 file:bg-[#00DF73]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#00DF73]';
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(16).slice(2)}`);

type LessonKind = 'text' | 'video' | 'document' | 'external';
type LessonFile = { id: string; kind: string; filename: string; content_type: string };
type LessonDraft = { id: string; dbId: string | null; title: string; content: string; kind: LessonKind; resourceUrl: string; durationMinutes: number; required: boolean; mediaFile: File | null; documentFile: File | null; existingFiles: LessonFile[] };
type ModuleDraft = { id: string; dbId: string | null; title: string; lessons: LessonDraft[] };
type QuestionDraft = { prompt: string; options: string[]; correct: number };
type CourseRow = { id: string; title: string; status: string; audience_type: string; audience_value: string | null; created_at: string; lessons: number; quizzes: number; assignments: number };

const newLesson = (): LessonDraft => ({ id: uid(), dbId: null, title: '', content: '', kind: 'text', resourceUrl: '', durationMinutes: 0, required: true, mediaFile: null, documentFile: null, existingFiles: [] });
const newModule = (): ModuleDraft => ({ id: uid(), dbId: null, title: '', lessons: [newLesson()] });
const newQuestion = (): QuestionDraft => ({ prompt: '', options: ['', ''], correct: 0 });

function Section({ step, title, hint, children }: { step: number; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-[#141C2F] p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00DF73]/10 text-sm font-bold text-[#00DF73]">{step}</span>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FileDrop({ label, accept, file, onChange }: { label: string; accept: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="block rounded-lg border border-dashed border-gray-700 bg-[#0B1120] p-3 text-xs font-semibold text-gray-400">
      {label}
      <input type="file" accept={accept} className={fileInput} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {file && <span className="mt-1 block truncate text-[11px] text-[#67dca3]">Selected: {file.name}</span>}
    </label>
  );
}

export default function TrainingWizard() {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

  // Wizard state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [modules, setModules] = useState<ModuleDraft[]>([newModule()]);
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([]);
  const [quizEnabled, setQuizEnabled] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [passMark, setPassMark] = useState(80);
  const [quizRequired, setQuizRequired] = useState(true);
  const [questionsList, setQuestionsList] = useState<QuestionDraft[]>([newQuestion()]);
  const [audience, setAudience] = useState('interns');
  const [dueDate, setDueDate] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [positions, setPositions] = useState<{ id: string; title: string; division: string }[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [busy, setBusy] = useState<'publish' | 'notify' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ assigned: number; notified: number } | null>(null);

  // Manage state
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [manageError, setManageError] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<CourseRow | null>(null);
  const [manageBusyId, setManageBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/people', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { people: [] })).then((d) => {
      setDepartments(Array.from(new Set((d.people || []).map((p: { department?: string }) => p.department).filter(Boolean))).sort() as string[]);
    }).catch(() => undefined);
    fetch('/api/training', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.positions) setPositions(d.positions.map((p: { id: string; title: string; division: string }) => ({ id: p.id, title: p.title, division: p.division })));
    }).catch(() => undefined);
    fetch('/api/training/job-titles', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (Array.isArray(d?.jobTitles)) setJobTitles(d.jobTitles as string[]);
    }).catch(() => undefined);
  }, []);

  const loadCourses = useCallback(() => {
    setLoadingCourses(true);
    setManageError('');
    return fetch('/api/training/courses', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : r.json().then((d: { error?: string }) => { throw new Error(d.error || 'Could not load courses'); })))
      .then((d) => setCourses(d.courses ?? []))
      .catch((e) => setManageError(e instanceof Error ? e.message : 'Could not load courses'))
      .finally(() => setLoadingCourses(false));
  }, []);

  function resetForm() {
    setEditingCourseId(null);
    setTitle(''); setDescription(''); setModules([newModule()]); setRemovedFileIds([]);
    setQuizEnabled(false); setQuizTitle(''); setPassMark(80); setQuizRequired(true); setQuestionsList([newQuestion()]);
    setAudience('interns'); setDueDate(''); setResult(null); setError('');
  }

  function updateModule(id: string, patch: Partial<ModuleDraft>) { setModules((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m))); }
  function updateLesson(moduleId: string, lessonId: string, patch: Partial<LessonDraft>) {
    setModules((list) => list.map((m) => (m.id === moduleId ? { ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)) } : m)));
  }
  function updateQuestion(index: number, patch: Partial<QuestionDraft>) { setQuestionsList((list) => list.map((q, i) => (i === index ? { ...q, ...patch } : q))); }

  function validate(): string | null {
    if (!title.trim()) return 'Enter a course title.';
    const lessons = modules.flatMap((m) => m.lessons);
    if (!lessons.length) return 'Add at least one lesson.';
    if (!modules.every((m) => m.title.trim())) return 'Every module needs a title.';
    for (const lesson of lessons) {
      if (!lesson.title.trim() || !lesson.content.trim()) return 'Every lesson needs a title and content.';
      const hasMedia = Boolean(lesson.mediaFile) || lesson.existingFiles.some((f) => f.kind === 'media' && !removedFileIds.includes(f.id));
      if (!lesson.mediaFile && lesson.kind !== 'text' && lesson.kind !== 'document' && !lesson.resourceUrl.trim() && !hasMedia) return `"${lesson.title}" needs an uploaded file or an HTTPS link.`;
    }
    if (quizEnabled) {
      if (!quizTitle.trim()) return 'Give the quiz a title.';
      if (!Number.isInteger(passMark) || passMark < 1 || passMark > 100) return 'The pass mark must be 1–100.';
      if (!questionsList.length) return 'Add at least one quiz question.';
      for (const q of questionsList) {
        if (!q.prompt.trim()) return 'Every quiz question needs a prompt.';
        if (q.options.length < 2 || q.options.some((o) => !o.trim())) return 'Every quiz question needs at least two filled choices.';
      }
    }
    return null;
  }

  async function submit(event: FormEvent, notify: boolean) {
    event.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError(''); setResult(null); setBusy(notify ? 'notify' : 'publish');
    try {
      const [audienceType, audienceValue] = audience.includes('::') ? audience.split('::') : [audience, null];
      const form = new FormData();
      const payload = {
        course: { title: title.trim(), description: description.trim() },
        audience: { type: audienceType, value: audienceValue },
        sections: modules.map((m) => ({ clientId: m.id, id: m.dbId, title: m.title.trim() })),
        lessons: modules.flatMap((m) => m.lessons.map((l) => ({
          clientId: l.id, id: l.dbId, sectionClientId: m.id,
          title: l.title.trim(), content: l.content.trim(), kind: l.kind,
          resourceUrl: l.mediaFile ? '' : l.resourceUrl.trim(),
          durationMinutes: Number(l.durationMinutes) || 0, required: l.required,
          mediaField: l.mediaFile ? `media_${l.id}` : null,
          documentField: l.documentFile ? `doc_${l.id}` : null,
        }))),
        removedFileIds,
        quiz: quizEnabled ? { title: quizTitle.trim(), passMark: Number(passMark), required: quizRequired, questions: questionsList.map((q) => ({ prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()), correct: q.correct })) } : null,
        dueDate: dueDate || null,
        publish: true,
        notify,
      };
      form.append('payload', JSON.stringify(payload));
      for (const lesson of modules.flatMap((m) => m.lessons)) {
        if (lesson.mediaFile) form.append(`media_${lesson.id}`, lesson.mediaFile);
        if (lesson.documentFile) form.append(`doc_${lesson.id}`, lesson.documentFile);
      }

      const response = await fetch(editingCourseId ? `/api/training/courses/${editingCourseId}` : '/api/training/wizard-publish', { method: editingCourseId ? 'PUT' : 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save the course.');
      if (editingCourseId) setResult({ assigned: 0, notified: data.notified ?? 0 });
      else setResult({ assigned: data.assigned ?? 0, notified: data.notified ?? 0 });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the course.');
    } finally { setBusy(null); }
  }

  async function editCourse(id: string) {
    setError(''); setResult(null); setManageBusyId(id);
    try {
      const response = await fetch(`/api/training/courses?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load the course.');
      const loadedModules: ModuleDraft[] = (data.sections ?? []).map((s: { id: string; title: string }) => ({ id: uid(), dbId: s.id, title: s.title, lessons: [] }));
      let fallback: ModuleDraft | null = null;
      for (const lesson of data.lessons ?? []) {
        let target: ModuleDraft | null = loadedModules.find((m) => m.dbId === lesson.section_id) ?? null;
        if (!target) {
          if (!fallback) { fallback = { id: uid(), dbId: null, title: 'Lessons', lessons: [] }; loadedModules.push(fallback); }
          target = fallback;
        }
        target.lessons.push({
          id: uid(), dbId: lesson.id, title: lesson.title, content: lesson.content, kind: lesson.kind, resourceUrl: lesson.resource_url,
          durationMinutes: lesson.duration_minutes, required: lesson.required === 1,
          mediaFile: null, documentFile: null, existingFiles: lesson.files ?? [],
        });
      }
      setModules(loadedModules.length ? loadedModules : [newModule()]);
      setTitle(data.course.title); setDescription(data.course.description ?? '');
      setAudience(data.course.audience_type === 'all' || data.course.audience_type === 'interns' ? data.course.audience_type : `${data.course.audience_type}::${data.course.audience_value}`);
      setQuizEnabled(Boolean(data.quiz));
      if (data.quiz) { setQuizTitle(data.quiz.title); setPassMark(data.quiz.pass_mark); setQuizRequired(Boolean(data.quiz.required)); setQuestionsList(data.quiz.questions.map((q: QuestionDraft) => ({ prompt: q.prompt, options: q.options, correct: q.correct }))); }
      setRemovedFileIds([]);
      setEditingCourseId(id);
      setActiveTab('create');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not load the course.');
    } finally { setManageBusyId(null); }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setManageBusyId(archiveTarget.id);
    try {
      const response = await fetch(`/api/training/courses/${archiveTarget.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not archive the course.');
      setArchiveTarget(null);
      await loadCourses();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not archive the course.');
      setArchiveTarget(null);
    } finally { setManageBusyId(null); }
  }

  function audienceText(row: CourseRow) {
    if (row.audience_type === 'all') return 'All Employees';
    if (row.audience_type === 'interns') return 'All Interns';
    if (row.audience_type === 'department') return row.audience_value || 'Department';
    if (row.audience_type === 'job_title') return `Position: ${row.audience_value || ''}`.trim();
    return positions.find((p) => p.id === row.audience_value)?.title || 'Position';
  }

  return (
    <div className="space-y-6 text-white">
      <div className="inline-flex rounded-lg border border-gray-800 bg-[#0B1120] p-1">
        <button type="button" onClick={() => setActiveTab('create')} className={`rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === 'create' ? 'bg-[#00DF73] text-[#0B1120]' : 'text-gray-400 hover:text-white'}`}>
          {editingCourseId ? 'Edit Course' : 'Training Publisher Wizard'}
        </button>
        <button type="button" onClick={() => { setActiveTab('manage'); void loadCourses(); }} className={`rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === 'manage' ? 'bg-[#00DF73] text-[#0B1120]' : 'text-gray-400 hover:text-white'}`}>
          Manage Existing Courses
        </button>
      </div>

      {activeTab === 'manage' && (
        <section className="rounded-xl border border-gray-800 bg-[#141C2F] p-6">
          {manageError && <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{manageError}</p>}
          {loadingCourses ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#0B1120]" />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
              <p className="font-semibold text-gray-300">No courses yet</p>
              <p className="mt-1 text-sm text-gray-500">Switch to the wizard tab to publish your first course.</p>
              <button type="button" className={`${primary} mt-5`} onClick={() => setActiveTab('create')}>Create a course</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-gray-500">
                  <tr><th className="px-3 py-2">Course Title</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Target Audience</th><th className="px-3 py-2">Date Created</th><th className="px-3 py-2 text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} className="border-t border-gray-800">
                      <td className="px-3 py-3">
                        <span className="font-semibold text-white">{course.title}</span>
                        <span className="block text-xs text-gray-500">{course.lessons} lesson{course.lessons === 1 ? '' : 's'}{course.quizzes ? ' · quiz' : ''}{course.assignments ? ` · ${course.assignments} assigned` : ''}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${course.status === 'published' ? 'border-[#00DF73]/30 bg-[#00DF73]/10 text-[#00DF73]' : course.status === 'archived' ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{course.status}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-300">{audienceText(course)}</td>
                      <td className="px-3 py-3 text-gray-400">{new Date(course.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-3 text-right">
                        <button type="button" className="mr-4 font-medium text-[#00DF73] hover:text-[#00c968] disabled:opacity-50" disabled={manageBusyId === course.id} onClick={() => void editCourse(course.id)}>Edit</button>
                        {course.status === 'archived'
                          ? <button type="button" className="font-medium text-gray-400 hover:text-white" disabled={manageBusyId === course.id} onClick={() => void fetch(`/api/training/courses/${course.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'published' }) }).then(() => loadCourses())}>Restore</button>
                          : <button type="button" className="font-medium text-red-400 hover:text-red-300" disabled={manageBusyId === course.id} onClick={() => setArchiveTarget(course)}>Archive</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'create' && (
        <form className="space-y-6" onSubmit={(e) => submit(e, false)}>
          {editingCourseId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-900/40 bg-amber-900/10 p-4 text-sm text-amber-200">
              <span>Editing an existing course. Employee progress is preserved.</span>
              <button type="button" className="text-xs underline" onClick={resetForm}>Cancel edit</button>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
          {result && <p role="status" className="rounded-lg border border-[#00DF73]/30 bg-[#00DF73]/10 p-4 text-sm text-[#67dca3]">{editingCourseId ? 'Course updated.' : `Published. Assigned to ${result.assigned} ${result.assigned === 1 ? 'person' : 'people'}`}{result.notified ? ` · ${result.notified} notified.` : '.'}</p>}

          <Section step={1} title="Course Basics" hint="The title and description employees see in My Training.">
            <label className="block text-sm font-semibold text-gray-300">Course title
              <input className={control} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label className="mt-4 block text-sm font-semibold text-gray-300">Description
              <textarea className={control} rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </Section>

          <Section step={2} title="Curriculum & Content" hint="Each lesson can carry one media file (MP4/MP3) and one supporting document (PDF).">
            <div className="space-y-6">
              {modules.map((mod, mi) => (
                <div key={mod.id} className="rounded-lg border border-gray-800 bg-[#0B1120] p-4">
                  <div className="flex items-center gap-3">
                    <input className={control} placeholder={`Module ${mi + 1} title`} value={mod.title} maxLength={200} onChange={(e) => updateModule(mod.id, { title: e.target.value })} />
                    {modules.length > 1 && <button type="button" className="text-red-400 hover:text-red-300" onClick={() => setModules((list) => list.filter((m) => m.id !== mod.id))}><Icon name="trash" size={16} /></button>}
                  </div>
                  <div className="mt-4 space-y-4">
                    {mod.lessons.map((lesson) => (
                      <div key={lesson.id} className="rounded-lg border border-gray-800 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-gray-400">Lesson title<input className={control} value={lesson.title} maxLength={200} onChange={(e) => updateLesson(mod.id, lesson.id, { title: e.target.value })} /></label>
                          <label className="text-xs font-semibold text-gray-400">Content type
                            <select className={control} value={lesson.kind} disabled={Boolean(lesson.mediaFile)} onChange={(e) => updateLesson(mod.id, lesson.id, { kind: e.target.value as LessonKind })}>
                              <option value="text">Text</option><option value="video">Video (MP4) / Audio (MP3)</option><option value="document">Document / PDF</option><option value="external">External resource</option>
                            </select>
                          </label>
                        </div>
                        <label className="mt-3 block text-xs font-semibold text-gray-400">Lesson content<textarea className={control} rows={2} maxLength={20000} value={lesson.content} onChange={(e) => updateLesson(mod.id, lesson.id, { content: e.target.value })} /></label>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <FileDrop label="Media (MP4 video or MP3 audio)" accept="video/mp4,audio/mpeg" file={lesson.mediaFile} onChange={(f) => updateLesson(mod.id, lesson.id, { mediaFile: f })} />
                          <FileDrop label="Supporting document (PDF)" accept="application/pdf" file={lesson.documentFile} onChange={(f) => updateLesson(mod.id, lesson.id, { documentFile: f })} />
                        </div>
                        {lesson.existingFiles.length > 0 && (
                          <ul className="mt-3 space-y-1 text-[11px]">
                            {lesson.existingFiles.map((file) => {
                              const removedNow = removedFileIds.includes(file.id);
                              return (
                                <li key={file.id} className="flex items-center gap-2">
                                  <a href={`/api/training/lesson-files/${file.id}`} target="_blank" rel="noopener noreferrer" className="text-[#67dca3] underline">{file.kind === 'media' ? '▶' : '📄'} {file.filename}</a>
                                  <button type="button" className={`underline ${removedNow ? 'text-gray-500' : 'text-red-400'}`} onClick={() => setRemovedFileIds((ids) => removedNow ? ids.filter((x) => x !== file.id) : [...ids, file.id])}>{removedNow ? 'Keep' : 'Remove'}</button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-gray-400">Or resource link (HTTPS)<input className={control} value={lesson.resourceUrl} disabled={Boolean(lesson.mediaFile)} placeholder="https://…" onChange={(e) => updateLesson(mod.id, lesson.id, { resourceUrl: e.target.value })} /></label>
                          <label className="text-xs font-semibold text-gray-400">Duration (minutes)<input type="number" min={0} className={control} value={lesson.durationMinutes} onChange={(e) => updateLesson(mod.id, lesson.id, { durationMinutes: Number(e.target.value) })} /></label>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={lesson.required} onChange={(e) => updateLesson(mod.id, lesson.id, { required: e.target.checked })} /> Required to complete the course</label>
                          {mod.lessons.length > 1 && <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => updateModule(mod.id, { lessons: mod.lessons.filter((l) => l.id !== lesson.id) })}>Remove lesson</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className={`${ghost} mt-4`} onClick={() => updateModule(mod.id, { lessons: [...mod.lessons, newLesson()] })}><Icon name="plus" size={14} /> Add lesson</button>
                </div>
              ))}
            </div>
            <button type="button" className={`${ghost} mt-4`} onClick={() => setModules((list) => [...list, newModule()])}><Icon name="plus" size={14} /> Add module</button>
          </Section>

          <Section step={3} title="Assessment" hint="One quiz per course. Passing is required to unlock the accountability assessment.">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300"><input type="checkbox" checked={quizEnabled} onChange={(e) => setQuizEnabled(e.target.checked)} /> Include a quiz</label>
            {quizEnabled && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-gray-400">Quiz title<input className={control} value={quizTitle} maxLength={200} onChange={(e) => setQuizTitle(e.target.value)} /></label>
                  <label className="text-xs font-semibold text-gray-400">Pass mark (%)<input type="number" min={1} max={100} className={control} value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} /></label>
                  <label className="mt-6 flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={quizRequired} onChange={(e) => setQuizRequired(e.target.checked)} /> Required to pass</label>
                </div>
                {questionsList.map((q, qi) => (
                  <div key={qi} className="rounded-lg border border-gray-800 bg-[#0B1120] p-4">
                    <label className="text-xs font-semibold text-gray-400">Question {qi + 1}<input className={control} value={q.prompt} onChange={(e) => updateQuestion(qi, { prompt: e.target.value })} /></label>
                    <div className="mt-3 space-y-2">
                      {q.options.map((option, oi) => (
                        <div key={oi} className="flex items-center gap-3">
                          <input type="radio" name={`correct-${qi}`} checked={q.correct === oi} onChange={() => updateQuestion(qi, { correct: oi })} title="Correct answer" />
                          <input className={control} placeholder={`Choice ${oi + 1}`} value={option} onChange={(e) => updateQuestion(qi, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })} />
                        </div>
                      ))}
                    </div>
                    {q.options.length < 6 && <button type="button" className={`${ghost} mt-3`} onClick={() => updateQuestion(qi, { options: [...q.options, ''] })}>Add choice</button>}
                    {questionsList.length > 1 && <button type="button" className="mt-3 ml-3 text-xs text-red-400 hover:text-red-300" onClick={() => setQuestionsList((list) => list.filter((_, i) => i !== qi))}>Remove question</button>}
                  </div>
                ))}
                <button type="button" className={ghost} onClick={() => setQuestionsList((list) => [...list, newQuestion()])}><Icon name="plus" size={14} /> Add question</button>
              </div>
            )}
          </Section>

          <Section step={4} title="Assignment & Publishing" hint="Who receives this compulsory course.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-300">Target audience
                <select className={control} value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="interns">All Interns</option>
                  <option value="all">All Employees</option>
                  {departments.map((d) => <option key={d} value={`department::${d}`}>{d}</option>)}
                  {jobTitles.map((title) => <option key={`job-${title}`} value={`job_title::${title}`}>Position: {title}</option>)}
                  {positions.map((p) => <option key={p.id} value={`position::${p.id}`}>Learning position: {p.title} — {p.division}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-300">Due date (optional)<input type="date" className={control} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
            </div>
          </Section>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-800 bg-[#0B1120]/95 p-4 backdrop-blur">
            <button type="submit" className={primary} disabled={busy !== null}>{busy === 'publish' ? 'Saving…' : editingCourseId ? 'Save changes' : 'Save & Publish'}</button>
            <button type="button" className={primary} disabled={busy !== null} onClick={(e) => submit(e, true)}>{busy === 'notify' ? 'Saving…' : editingCourseId ? 'Save & Notify' : 'Publish & Notify Interns'}</button>
          </div>
        </form>
      )}

      {archiveTarget && (
        <div className="fixed inset-0 z-[210] grid place-items-center bg-black/75 p-4" onMouseDown={() => setArchiveTarget(null)}>
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-[#141C2F] p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Archive “{archiveTarget.title}”?</h2>
            <p className="mt-2 text-sm text-gray-400">The course is archived, not deleted. Existing employee training progress and assignments are preserved, and you can restore it later.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className={ghost} onClick={() => setArchiveTarget(null)}>Cancel</button>
              <button type="button" className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-50" disabled={manageBusyId === archiveTarget.id} onClick={() => void confirmArchive()}>{manageBusyId === archiveTarget.id ? 'Archiving…' : 'Archive course'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
