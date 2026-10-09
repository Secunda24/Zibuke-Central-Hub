import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";

import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  try {
    // Fetch posts and join with the users table to get the author's real name and team
    const { results } = await db.prepare(`
      SELECT posts.id, posts.content, posts.created_at, users.first_name || ' ' || users.last_name AS name, users.department
      FROM posts
      JOIN users ON posts.author_id = users.id
      ORDER BY posts.created_at DESC
      LIMIT 50
    `).all<Pick<DatabaseRows["posts"], "id" | "content" | "created_at"> & Pick<DatabaseRows["users"], "department"> & {"name":string}>();

    return NextResponse.json({ posts: results });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  // SECURE: Identify the author from the verified session
  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }
  const authorId = session.userId;

  try {
    const { content } = await request.json();
    
    if (!content) {
      return NextResponse.json({ error: "Post content is required" }, { status: 400 });
    }

    const postId = crypto.randomUUID();

    // Inject the new post into the database
    await db.prepare(
      'INSERT INTO posts (id, author_id, content) VALUES (?, ?, ?)'
    ).bind(postId, authorId, content).run();

    return NextResponse.json({ success: true, message: "Update posted" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to post update" }, { status: 500 });
  }
}