import { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { context, failure } from '@/src/modules/training/server';
import { downloadHeaders } from '@/src/modules/backend/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams one lesson file from the private bucket. Admins, or employees assigned to the
// lesson's course, may read it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, actor } = await context(request);
    const id = (await params).id;
    const file = await db.prepare(`
      SELECT f.storage_key, f.content_type, f.filename, f.kind, l.course_id, l.title
      FROM learning_lesson_files f JOIN learning_lessons l ON l.id = f.lesson_id
      WHERE f.id = ?`).bind(id).first<{ storage_key: string; content_type: string; filename: string; kind: string; course_id: string; title: string }>();
    if (!file) throw new Response('File not found', { status: 404 });

    if (actor.role !== 'admin') {
      const assigned = await db.prepare('SELECT 1 AS ok FROM learning_assignments WHERE user_id = ? AND course_id = ?').bind(actor.id, file.course_id).first<{ ok: number }>();
      if (!assigned) throw new Response('Forbidden', { status: 403 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const object = await env.COLLAB_BUCKET.get(file.storage_key);
    if (!object) throw new Response('File not found', { status: 404 });
    return new Response(object.body as unknown as BodyInit, { headers: downloadHeaders(file.filename || file.title, file.content_type || 'application/octet-stream') });
  } catch (error) {
    return failure(error);
  }
}
