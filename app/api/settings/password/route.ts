import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "node:crypto";

import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  try {
    const { currentPassword, newPassword } = await request.json();
    
    if (typeof currentPassword!=='string'||!currentPassword||currentPassword.length>1024||typeof newPassword!=='string'||newPassword.length<8||newPassword.length>1024) {
      return NextResponse.json({ error: "Invalid password data. New password must be at least 8 characters." }, { status: 400 });
    }

    // 1. Fetch the user's current security data
    const user = await db.prepare(
      'SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?'
    ).bind(userId).first<Pick<DatabaseRows["users"], "password_hash" | "password_salt" | "password_iterations">>();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Verify the current password (with fallback for the initial default password)
    let isMatch = false;

    if (!user.password_salt) {
      isMatch = currentPassword === user.password_hash;
    } else {
      const testHash = crypto.pbkdf2Sync(
        currentPassword, 
        user.password_salt as string, 
        user.password_iterations as number, 
        64, 
        'sha256'
      ).toString('hex');
      isMatch = testHash === user.password_hash;
    }

    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    // 3. Generate a brand new salt and hash for the new password
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newIterations = 100000;
    const newHash = crypto.pbkdf2Sync(
      newPassword, 
      newSalt, 
      newIterations, 
      64, 
      'sha256'
    ).toString('hex');

    // 4. Update the database
    await db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ?, password_iterations = ?, password_updated_at = datetime('now') 
      WHERE id = ?
    `).bind(newHash, newSalt, newIterations, userId).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "An error occurred while updating the password." }, { status: 500 });
  }
}
