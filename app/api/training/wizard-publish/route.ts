import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { context, failure } from '@/src/modules/training/server';
import { questions, text, url, validDate } from '@/src/modules/training/domain';
import { createNotification } from '@/src/modules/backend/notifications';
import { takeUpload, type UploadedFile } from '@/src/modules/training/files';

export const runtime = 'nodejs';

const AUDIENCES = new Set(['all', 'interns', 'department', 'job_title', 'position']);
const KINDS = new Set(['text', 'video', 'document', 'external']);

type IncomingLesson = { clientId?: string; sectionClientId?: string | null; title?: unknown; content?: unknown; kind?: unknown; resourceUrl?: unknown; durationMinutes?: unknown; required?: unknown; mediaField?: string | null; documentField?: string | null };
type IncomingSection = { clientId?: string; title?: unknown };

export async function POST(request: NextRequest) {
  const uploadedKeys: string[] = [];
  let collab: R2Bucket | null = null;
  try {
    const { db, actor } = await context(request);
    if (actor.role !== 'admin') throw new Response('Only administrators can publish training', { status: 403 });
    const { env } = await getCloudflareContext({ async: true });
    collab = env.COLLAB_BUCKET;

    const form = await request.formData();
    const rawPayload = form.get('payload');
    if (typeof rawPayload !== 'string') throw new Response('Missing payload', { status: 400 });
    const payload = JSON.parse(rawPayload) as {
      course?: { title?: unknown; description?: unknown };
      sections?: IncomingSection[];
      lessons?: IncomingLesson[];
      quiz?: { title?: unknown; passMark?: unknown; required?: unknown; questions?: unknown } | null;
      audience?: { type?: string; value?: string | null };
      dueDate?: string | null;
      publish?: boolean;
      notify?: boolean;
    };

    const title = text(payload.course?.title, 'course title', 200);
    const description = text(payload.course?.description ?? '', 'description', 5000, true);
    const publish = payload.publish !== false;
    const notify = payload.notify === true;
    const audienceType = String(payload.audience?.type || '');
    const audienceValue = payload.audience?.value ? String(payload.audience.value).trim().slice(0, 200) : null;
    if (!AUDIENCES.has(audienceType)) throw new Response('Choose a valid audience', { status: 400 });
    if ((audienceType === 'department' || audienceType === 'position' || audienceType === 'job_title') && !audienceValue) throw new Response('Choose a department, position or job title', { status: 400 });
    const dueDate = payload.dueDate ? validDate(payload.dueDate) : null;

    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    if (sections.length > 100) throw new Response('Too many modules', { status: 400 });
    const sectionIds = new Map<string, string>();
    for (const section of sections) sectionIds.set(String(section.clientId || crypto.randomUUID()), crypto.randomUUID());
    const sectionRows = sections.map((section, index) => ({ id: sectionIds.get(String(section.clientId || '')) || crypto.randomUUID(), title: text(section.title, 'module title', 200), sortOrder: index }));

    const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
    if (!lessons.length) throw new Response('Add at least one lesson', { status: 400 });
    if (lessons.length > 200) throw new Response('Too many lessons', { status: 400 });

    const courseId = crypto.randomUUID();
    const lessonRows: { id: string; sectionId: string | null; title: string; content: string; resourceUrl: string; kind: string; required: number; sortOrder: number; duration: number }[] = [];
    const fileRows: UploadedFile[] = [];

    // Upload every file first (compensated below if the DB write fails).
    async function upload(fileField: string, lessonId: string, lessonTitle: string, kind: 'media' | 'document'): Promise<UploadedFile | null> {
      const uploaded = await takeUpload(form, fileField, lessonId, lessonTitle, kind, collab!);
      if (uploaded) uploadedKeys.push(uploaded.storageKey);
      return uploaded;
    }

    for (const [index, lesson] of lessons.entries()) {
      const lessonId = crypto.randomUUID();
      const lessonTitle = text(lesson.title, 'lesson title', 200);
      const content = text(lesson.content, 'lesson content', 20000);
      const duration = lesson.durationMinutes ?? 0;
      if (!Number.isInteger(duration) || (duration as number) < 0 || (duration as number) > 10000) throw new Response('Invalid lesson duration', { status: 400 });
      const sectionClientId = lesson.sectionClientId ? String(lesson.sectionClientId) : null;
      if (sectionClientId && !sectionIds.has(sectionClientId)) throw new Response('A lesson references a module that does not exist', { status: 400 });

      const media = lesson.mediaField ? await upload(lesson.mediaField, lessonId, lessonTitle, 'media') : null;
      const document = lesson.documentField ? await upload(lesson.documentField, lessonId, lessonTitle, 'document') : null;
      if (media) fileRows.push(media);
      if (document) fileRows.push(document);

      const resourceUrl = url(lesson.resourceUrl, true);
      let kind = KINDS.has(String(lesson.kind)) ? String(lesson.kind) : 'text';
      if (media) kind = 'video';
      else if (document) kind = 'document';
      else if (kind !== 'text' && kind !== 'external' && !resourceUrl) throw new Response(`"${lessonTitle}" needs a media file, a document or an HTTPS link`, { status: 400 });

      lessonRows.push({ id: lessonId, sectionId: sectionClientId ? sectionIds.get(sectionClientId)! : null, title: lessonTitle, content, resourceUrl, kind, required: lesson.required === false ? 0 : 1, sortOrder: index, duration: duration as number });
    }

    if (publish && !lessonRows.some((l) => l.required)) throw new Response('Mark at least one lesson as required before publishing', { status: 400 });

    let quizRow: { id: string; title: string; passMark: number; required: number; questions: string } | null = null;
    if (payload.quiz) {
      const passMark = payload.quiz.passMark;
      if (!Number.isInteger(passMark) || (passMark as number) < 1 || (passMark as number) > 100) throw new Response('Choose a pass mark from 1 to 100', { status: 400 });
      quizRow = { id: crypto.randomUUID(), title: text(payload.quiz.title, 'quiz title', 200), passMark: passMark as number, required: payload.quiz.required === false ? 0 : 1, questions: JSON.stringify(questions(payload.quiz.questions)) };
    }

    // Resolve the audience to concrete user ids (never the acting admin).
    let audienceIds: string[] = [];
    if (audienceType === 'all') {
      audienceIds = (await db.prepare("SELECT id FROM users WHERE role='employee' AND id != ? AND archived_at IS NULL").bind(actor.id).all<{ id: string }>()).results.map((r) => r.id);
    } else if (audienceType === 'interns') {
      audienceIds = (await db.prepare("SELECT id FROM users u WHERE u.id != ? AND u.archived_at IS NULL AND (u.job_title LIKE '%Intern%' OR EXISTS(SELECT 1 FROM employee_internships i WHERE i.user_id = u.id AND i.status='active'))").bind(actor.id).all<{ id: string }>()).results.map((r) => r.id);
    } else if (audienceType === 'department') {
      audienceIds = (await db.prepare('SELECT id FROM users WHERE department = ? AND id != ? AND archived_at IS NULL').bind(audienceValue, actor.id).all<{ id: string }>()).results.map((r) => r.id);
    } else if (audienceType === 'job_title') {
      // Match on the stored job title, trimmed and case-insensitive so stray whitespace or casing
      // in the free-text field can't cause a silent miss.
      audienceIds = (await db.prepare("SELECT id FROM users WHERE id != ? AND archived_at IS NULL AND LOWER(TRIM(COALESCE(job_title,''))) = LOWER(TRIM(?))").bind(actor.id, audienceValue).all<{ id: string }>()).results.map((r) => r.id);
    } else {
      audienceIds = (await db.prepare('SELECT user_id AS id FROM learning_candidates WHERE position_id = ? AND user_id != ? AND EXISTS(SELECT 1 FROM users u WHERE u.id = user_id AND u.archived_at IS NULL)').bind(audienceValue, actor.id).all<{ id: string }>()).results.map((r) => r.id);
    }

    // One ordered, atomic batch: course -> sections -> lessons -> files -> quiz -> position binding -> assignments -> audit.
    // Assignments are written last so the freeze_assigned_lessons/quizzes triggers never fire.
    const statements: D1PreparedStatement[] = [];
    statements.push(db.prepare('INSERT INTO learning_courses(id,title,description,status,created_by,audience_type,audience_value) VALUES(?,?,?,?,?,?,?)').bind(courseId, title, description, publish ? 'published' : 'draft', actor.id, audienceType, audienceValue));
    for (const section of sectionRows) statements.push(db.prepare('INSERT INTO learning_sections(id,course_id,title,sort_order) VALUES(?,?,?,?)').bind(section.id, courseId, section.title, section.sortOrder));
    for (const lesson of lessonRows) statements.push(db.prepare('INSERT INTO learning_lessons(id,course_id,section_id,title,content,resource_url,kind,required,sort_order,duration_minutes) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(lesson.id, courseId, lesson.sectionId, lesson.title, lesson.content, lesson.resourceUrl, lesson.kind, lesson.required, lesson.sortOrder, lesson.duration));
    for (const file of fileRows) statements.push(db.prepare('INSERT INTO learning_lesson_files(id,lesson_id,kind,storage_key,content_type,filename,size,sort_order) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), file.lessonId, file.kind, file.storageKey, file.contentType, file.filename, file.size, file.kind === 'media' ? 0 : 1));
    if (quizRow) statements.push(db.prepare('INSERT INTO learning_quizzes(id,course_id,title,pass_mark,required,questions) VALUES(?,?,?,?,?,?)').bind(quizRow.id, courseId, quizRow.title, quizRow.passMark, quizRow.required, quizRow.questions));
    if (audienceType === 'position') statements.push(db.prepare('INSERT OR IGNORE INTO learning_position_courses(position_id,course_id) VALUES(?,?)').bind(audienceValue, courseId));
    for (const userId of audienceIds) statements.push(db.prepare('INSERT INTO learning_assignments(user_id,course_id,required,due_date,assigned_by) VALUES(?,?,1,?,?) ON CONFLICT(user_id,course_id) DO UPDATE SET required=1').bind(userId, courseId, dueDate, actor.id));
    statements.push(db.prepare('INSERT INTO learning_audit(id,actor_id,user_id,action,entity_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, null, 'wizard_publish', courseId));

    try {
      await db.batch(statements);
    } catch (error) {
      for (const key of uploadedKeys) { try { await collab.delete(key); } catch { /* best effort */ } }
      throw error;
    }

    let notified = 0;
    if (notify) {
      try {
        for (const userId of audienceIds) {
          await createNotification(db, { id: `training:wizard:${courseId}:${userId}`, userId, content: `A new compulsory course "${title}" has been assigned to you.`, kind: 'training_assigned', entityType: 'training', entityId: courseId, actorId: actor.id });
          notified += 1;
        }
      } catch (error) {
        console.error('Wizard notification delivery deferred', error);
      }
    }

    return Response.json({ ok: true, courseId, assigned: audienceIds.length, notified, published: publish });
  } catch (error) {
    return failure(error);
  }
}
