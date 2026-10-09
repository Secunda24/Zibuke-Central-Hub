import { NextRequest } from 'next/server';
import { context, failure } from '@/src/modules/training/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CourseRow = { id: string; title: string; status: string; audience_type: string; audience_value: string | null; created_at: string; lessons: number; quizzes: number; assignments: number };
type LessonRow = { id: string; section_id: string | null; title: string; content: string; kind: string; resource_url: string; duration_minutes: number; required: number; sort_order: number };
type FileRow = { id: string; lesson_id: string; kind: string; content_type: string; filename: string; size: number; sort_order: number };

// GET /api/training/courses        -> list for the "Manage courses" table
// GET /api/training/courses?id=... -> full detail to populate the wizard for editing
export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await context(request);
    if (actor.role !== 'admin') throw new Response('Only administrators can manage courses', { status: 403 });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      const { results } = await db.prepare(`
        SELECT c.id, c.title, c.status, c.audience_type, c.audience_value, c.created_at,
          (SELECT COUNT(*) FROM learning_lessons l WHERE l.course_id = c.id) AS lessons,
          (SELECT COUNT(*) FROM learning_quizzes q WHERE q.course_id = c.id) AS quizzes,
          (SELECT COUNT(*) FROM learning_assignments a WHERE a.course_id = c.id) AS assignments
        FROM learning_courses c
        ORDER BY c.created_at DESC, c.title`).all<CourseRow>();
      return Response.json({ courses: results }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const course = await db.prepare('SELECT id,title,description,status,audience_type,audience_value,created_at FROM learning_courses WHERE id = ?').bind(id).first<{ id: string; title: string; description: string; status: string; audience_type: string; audience_value: string | null; created_at: string }>();
    if (!course) throw new Response('Course not found', { status: 404 });

    const sections = (await db.prepare('SELECT id,title,sort_order FROM learning_sections WHERE course_id = ? ORDER BY sort_order,title').bind(id).all<{ id: string; title: string; sort_order: number }>()).results;
    const lessons = (await db.prepare('SELECT id,section_id,title,content,kind,resource_url,duration_minutes,required,sort_order FROM learning_lessons WHERE course_id = ? ORDER BY sort_order,title').bind(id).all<LessonRow>()).results;
    const files = (await db.prepare('SELECT f.id,f.lesson_id,f.kind,f.content_type,f.filename,f.size,f.sort_order FROM learning_lesson_files f JOIN learning_lessons l ON l.id = f.lesson_id WHERE l.course_id = ? ORDER BY f.sort_order').bind(id).all<FileRow>()).results;
    const quiz = await db.prepare('SELECT id,title,pass_mark,required,questions FROM learning_quizzes WHERE course_id = ?').bind(id).first<{ id: string; title: string; pass_mark: number; required: number; questions: string }>();
    const assignments = (await db.prepare('SELECT COUNT(*) AS c FROM learning_assignments WHERE course_id = ?').bind(id).first<{ c: number }>())?.c ?? 0;

    const byLesson = new Map<string, FileRow[]>();
    for (const file of files) { if (!byLesson.has(file.lesson_id)) byLesson.set(file.lesson_id, []); byLesson.get(file.lesson_id)!.push(file); }

    return Response.json({
      course,
      assignments,
      sections,
      lessons: lessons.map((lesson) => ({ ...lesson, files: byLesson.get(lesson.id) ?? [] })),
      quiz: quiz ? { title: quiz.title, pass_mark: quiz.pass_mark, required: quiz.required === 1, questions: JSON.parse(quiz.questions) } : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
