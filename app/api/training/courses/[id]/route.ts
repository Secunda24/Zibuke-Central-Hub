import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { context, failure } from '@/src/modules/training/server';
import { questions, text, url } from '@/src/modules/training/domain';
import { takeUpload, type UploadedFile } from '@/src/modules/training/files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUDIENCES = new Set(['all', 'interns', 'department', 'job_title', 'position']);
const KINDS = new Set(['text', 'video', 'document', 'external']);
const STATUSES = new Set(['draft', 'published', 'archived']);

type IncomingLesson = { clientId?: string; id?: string | null; sectionClientId?: string | null; title?: unknown; content?: unknown; kind?: unknown; resourceUrl?: unknown; durationMinutes?: unknown; required?: unknown; mediaField?: string | null; documentField?: string | null };
type IncomingSection = { clientId?: string; id?: string | null; title?: unknown };

// PATCH: soft status change (archive / restore / publish).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, actor } = await context(request);
    if (actor.role !== 'admin') throw new Response('Only administrators can manage courses', { status: 403 });
    const courseId = (await params).id;
    const body = await request.json().catch(() => ({}));
    const status = String(body?.status || '');
    if (!STATUSES.has(status)) throw new Response('Invalid status', { status: 400 });
    const course = await db.prepare('SELECT id FROM learning_courses WHERE id = ?').bind(courseId).first<{ id: string }>();
    if (!course) throw new Response('Course not found', { status: 404 });
    if (status === 'published') {
      const required = await db.prepare('SELECT COUNT(*) AS c FROM learning_lessons WHERE course_id = ? AND required = 1').bind(courseId).first<{ c: number }>();
      if (!required?.c) throw new Response('Add at least one required lesson before publishing', { status: 400 });
    }
    await db.batch([
      db.prepare('UPDATE learning_courses SET status = ? WHERE id = ?').bind(status, courseId),
      db.prepare('INSERT INTO learning_audit(id,actor_id,user_id,action,entity_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, null, `course_${status}`, courseId),
    ]);
    return Response.json({ ok: true, status });
  } catch (error) {
    return failure(error);
  }
}

// DELETE: soft delete. Progress and assignments are preserved (status becomes 'archived').
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, actor } = await context(request);
    if (actor.role !== 'admin') throw new Response('Only administrators can manage courses', { status: 403 });
    const courseId = (await params).id;
    const course = await db.prepare('SELECT id FROM learning_courses WHERE id = ?').bind(courseId).first<{ id: string }>();
    if (!course) throw new Response('Course not found', { status: 404 });
    await db.batch([
      db.prepare("UPDATE learning_courses SET status = 'archived' WHERE id = ?").bind(courseId),
      db.prepare('INSERT INTO learning_audit(id,actor_id,user_id,action,entity_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, null, 'course_archived', courseId),
    ]);
    return Response.json({ ok: true, status: 'archived' });
  } catch (error) {
    return failure(error);
  }
}

// PUT: in-place update from the wizard (multipart). Adds sections/lessons only when unassigned,
// so employees' existing lesson progress is never destroyed.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uploadedKeys: string[] = [];
  let collab: R2Bucket | null = null;
  try {
    const { db, actor } = await context(request);
    if (actor.role !== 'admin') throw new Response('Only administrators can manage courses', { status: 403 });
    const courseId = (await params).id;
    const course = await db.prepare('SELECT id FROM learning_courses WHERE id = ?').bind(courseId).first<{ id: string }>();
    if (!course) throw new Response('Course not found', { status: 404 });
    const { env } = await getCloudflareContext({ async: true });
    collab = env.COLLAB_BUCKET;
    const assigned = ((await db.prepare('SELECT COUNT(*) AS c FROM learning_assignments WHERE course_id = ?').bind(courseId).first<{ c: number }>())?.c ?? 0) > 0;

    const form = await request.formData();
    const rawPayload = form.get('payload');
    if (typeof rawPayload !== 'string') throw new Response('Missing payload', { status: 400 });
    const payload = JSON.parse(rawPayload) as {
      course?: { title?: unknown; description?: unknown };
      audience?: { type?: string; value?: string | null };
      sections?: IncomingSection[];
      lessons?: IncomingLesson[];
      removedFileIds?: string[];
      quiz?: { title?: unknown; passMark?: unknown; required?: unknown; questions?: unknown } | null;
    };

    const title = text(payload.course?.title, 'course title', 200);
    const description = text(payload.course?.description ?? '', 'description', 5000, true);
    const audienceType = String(payload.audience?.type || '');
    const audienceValue = payload.audience?.value ? String(payload.audience.value).trim().slice(0, 200) : null;
    if (!AUDIENCES.has(audienceType)) throw new Response('Choose a valid audience', { status: 400 });
    if ((audienceType === 'department' || audienceType === 'position' || audienceType === 'job_title') && !audienceValue) throw new Response('Choose a department, position or job title', { status: 400 });

    // Existing section/lesson ids that legitimately belong to this course.
    const existingSections = new Set((await db.prepare('SELECT id FROM learning_sections WHERE course_id = ?').bind(courseId).all<{ id: string }>()).results.map((r) => r.id));
    const existingLessons = new Set((await db.prepare('SELECT id FROM learning_lessons WHERE course_id = ?').bind(courseId).all<{ id: string }>()).results.map((r) => r.id));

    const statements: D1PreparedStatement[] = [];
    statements.push(db.prepare('UPDATE learning_courses SET title = ?, description = ?, audience_type = ?, audience_value = ? WHERE id = ?').bind(title, description, audienceType, audienceValue, courseId));

    const sectionIdByClient = new Map<string, string>();
    for (const [index, section] of (payload.sections ?? []).entries()) {
      const clientId = String(section.clientId || crypto.randomUUID());
      const sectionTitle = text(section.title, 'module title', 200);
      if (section.id) {
        if (!existingSections.has(section.id)) throw new Response('A module does not belong to this course', { status: 400 });
        sectionIdByClient.set(clientId, section.id);
        statements.push(db.prepare('UPDATE learning_sections SET title = ?, sort_order = ? WHERE id = ?').bind(sectionTitle, index, section.id));
      } else {
        const newId = crypto.randomUUID();
        sectionIdByClient.set(clientId, newId);
        statements.push(db.prepare('INSERT INTO learning_sections(id,course_id,title,sort_order) VALUES(?,?,?,?)').bind(newId, courseId, sectionTitle, index));
      }
    }

    const fileRows: UploadedFile[] = [];
    for (const [index, lesson] of (payload.lessons ?? []).entries()) {
      const lessonTitle = text(lesson.title, 'lesson title', 200);
      const content = text(lesson.content, 'lesson content', 20000);
      const duration = lesson.durationMinutes ?? 0;
      if (!Number.isInteger(duration) || (duration as number) < 0 || (duration as number) > 10000) throw new Response('Invalid lesson duration', { status: 400 });
      const sectionId = lesson.sectionClientId ? sectionIdByClient.get(String(lesson.sectionClientId)) ?? null : null;
      if (lesson.sectionClientId && !sectionId) throw new Response('A lesson references a module that does not exist', { status: 400 });
      let lessonId: string;
      if (lesson.id) {
        if (!existingLessons.has(lesson.id)) throw new Response('A lesson does not belong to this course', { status: 400 });
        lessonId = lesson.id;
      } else {
        if (assigned) throw new Response('This course is assigned. Create a new course version to add lessons so employee progress is not reset.', { status: 409 });
        lessonId = crypto.randomUUID();
      }

      const media = lesson.mediaField ? await takeUpload(form, lesson.mediaField, lessonId, lessonTitle, 'media', collab) : null;
      const document = lesson.documentField ? await takeUpload(form, lesson.documentField, lessonId, lessonTitle, 'document', collab) : null;
      if (media) { uploadedKeys.push(media.storageKey); fileRows.push(media); }
      if (document) { uploadedKeys.push(document.storageKey); fileRows.push(document); }

      const resourceUrl = url(lesson.resourceUrl, true);
      let kind = KINDS.has(String(lesson.kind)) ? String(lesson.kind) : 'text';
      if (media) kind = 'video';
      else if (document) kind = 'document';

      if (lesson.id) {
        statements.push(db.prepare('UPDATE learning_lessons SET section_id = ?, title = ?, content = ?, resource_url = ?, kind = ?, required = ?, sort_order = ?, duration_minutes = ? WHERE id = ?').bind(sectionId, lessonTitle, content, resourceUrl, kind, lesson.required === false ? 0 : 1, index, duration as number, lessonId));
      } else {
        statements.push(db.prepare('INSERT INTO learning_lessons(id,course_id,section_id,title,content,resource_url,kind,required,sort_order,duration_minutes) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(lessonId, courseId, sectionId, lessonTitle, content, resourceUrl, kind, lesson.required === false ? 0 : 1, index, duration as number));
      }
    }

    for (const file of fileRows) statements.push(db.prepare('INSERT INTO learning_lesson_files(id,lesson_id,kind,storage_key,content_type,filename,size,sort_order) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), file.lessonId, file.kind, file.storageKey, file.contentType, file.filename, file.size, file.kind === 'media' ? 0 : 1));

    const removed = (payload.removedFileIds ?? []).filter((id) => typeof id === 'string' && id);
    if (removed.length) {
      statements.push(db.prepare(`DELETE FROM learning_lesson_files WHERE id IN (${removed.map(() => '?').join(',')}) AND lesson_id IN (SELECT id FROM learning_lessons WHERE course_id = ?)`).bind(...removed, courseId));
    }

    const existingQuiz = await db.prepare('SELECT id FROM learning_quizzes WHERE course_id = ?').bind(courseId).first<{ id: string }>();
    if (payload.quiz) {
      const passMark = payload.quiz.passMark;
      if (!Number.isInteger(passMark) || (passMark as number) < 1 || (passMark as number) > 100) throw new Response('Choose a pass mark from 1 to 100', { status: 400 });
      const quizTitle = text(payload.quiz.title, 'quiz title', 200);
      const quizRequired = payload.quiz.required === false ? 0 : 1;
      const quizQuestions = JSON.stringify(questions(payload.quiz.questions));
      if (existingQuiz) statements.push(db.prepare('UPDATE learning_quizzes SET title = ?, pass_mark = ?, required = ?, questions = ? WHERE id = ?').bind(quizTitle, passMark as number, quizRequired, quizQuestions, existingQuiz.id));
      else if (assigned) throw new Response('This course is assigned. Its quiz cannot be added retroactively; create a new course version.', { status: 409 });
      else statements.push(db.prepare('INSERT INTO learning_quizzes(id,course_id,title,pass_mark,required,questions) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), courseId, quizTitle, passMark as number, quizRequired, quizQuestions));
    }

    statements.push(db.prepare('INSERT INTO learning_audit(id,actor_id,user_id,action,entity_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, null, 'wizard_update', courseId));

    try {
      await db.batch(statements);
    } catch (error) {
      for (const key of uploadedKeys) { try { await collab.delete(key); } catch { /* best effort */ } }
      throw error;
    }
    return Response.json({ ok: true, courseId });
  } catch (error) {
    return failure(error);
  }
}
