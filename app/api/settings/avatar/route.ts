import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

import { verifySession } from "@/src/modules/auth/session";
import {validateDocument} from '@/src/modules/documents/server';
import {downloadHeaders} from '@/src/modules/backend/access';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const bucket = env.AVATARS_BUCKET;

  // 1. Authenticate the user
  const session = await verifySession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  try {
    // 2. Extract the file from the incoming FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!(file instanceof File)||!file.size||file.size>5*1024*1024) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 3. Format the file and generate a unique name
    let checked;
    try {checked=await validateDocument(file);}catch{return NextResponse.json({error:'Choose a JPEG or PNG image up to 5 MB'},{status:400});}
    if(!['image/jpeg','image/png'].includes(checked.type))return NextResponse.json({error:'Choose a JPEG or PNG image'},{status:400});
    const arrayBuffer = checked.bytes;
    const fileExtension = checked.type==='image/png'?'png':'jpg';
    const uniqueFilename = `avatar_${userId}_${Date.now()}.${fileExtension}`;

    // 4. Upload directly to the Cloudflare R2 bucket
    await bucket.put(uniqueFilename, arrayBuffer, {
      httpMetadata: {
        contentType: checked.type,
      },
    });

    // 5. Update the user's database record with the new avatar reference
    await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
      .bind(uniqueFilename, userId)
      .run();

    return NextResponse.json({ 
      success: true, 
      message: "Avatar uploaded successfully",
      filename: uniqueFilename
    });

  } catch (error) {
    console.error("Avatar upload failed:", error);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const bucket = env.AVATARS_BUCKET;

  // NEW: Check the URL for a specific user ID first
  const { searchParams } = new URL(request.url);
  const queryUserId = searchParams.get('userId');

  // Require a valid session; ?userId= lets a signed-in user view a colleague's avatar
  const session = await verifySession(request.cookies);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const userId = queryUserId || session.userId;

  try {
    // 1. Get the filename from the database
    const user = await db.prepare('SELECT avatar_url FROM users WHERE id = ?')
      .bind(userId)
      .first<Pick<DatabaseRows["users"], "avatar_url">>();

    if (!user || !user.avatar_url) {
      return new NextResponse("Not found", { status: 404 });
    }

    // 2. Fetch the file from the R2 bucket
    const object = await bucket.get(user.avatar_url as string);

    if (object === null) {
      return new NextResponse("Not found", { status: 404 });
    }

    // 3. Send the image directly to the browser
    const headers = downloadHeaders(String(user.avatar_url),object.httpMetadata?.contentType||'application/octet-stream');
    headers.set('etag', object.httpEtag);

    return new NextResponse(object.body as unknown as BodyInit, { headers });
  } catch (error) {
    console.error("Failed to fetch avatar:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
