import { NextRequest } from 'next/server';
import { context, failure } from '@/src/modules/training/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Distinct employee job titles for the Training Wizard audience picker. Admin-only, and archived
// staff are excluded so a title nobody currently holds is never offered.
export async function GET(request: NextRequest) {
  try {
    const { db, actor } = await context(request);
    if (actor.role !== 'admin') throw new Response('Forbidden', { status: 403 });

    const { results } = await db.prepare(`
      SELECT DISTINCT TRIM(job_title) AS job_title
      FROM users
      WHERE job_title IS NOT NULL AND TRIM(job_title) <> '' AND archived_at IS NULL
      ORDER BY TRIM(job_title) COLLATE NOCASE ASC
    `).all<{ job_title: string }>();

    return Response.json(
      { jobTitles: results.map((row) => row.job_title) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return failure(error);
  }
}
