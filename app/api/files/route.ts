import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, NextRequest } from "next/server";
import crypto from "crypto";
import { verifySession } from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const session = await verifySession(request.cookies);
  
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await db.prepare("SELECT department, role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "department" | "role">>();
    const userDept = user?.department || "General";
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    const isAdmin = user.role === 'admin';
    const {results: departments} = await db.prepare("SELECT id,name FROM file_departments WHERE id='General' OR id=? OR ?='Executive' OR ?='admin' ORDER BY CASE WHEN id='General' THEN 0 ELSE 1 END,name COLLATE NOCASE").bind(userDept,userDept,user.role).all<{id:string;name:string}>();

    // Access Control: General files + Own Department files + Executive sees all
    const { results } = await db.prepare(`
      SELECT files.*, COALESCE(d.name,files.department) AS department_name, users.first_name || ' ' || users.last_name as uploader_name 
      FROM files 
      JOIN users ON files.uploaded_by = users.id
      LEFT JOIN file_departments d ON d.id=files.department 
      WHERE files.department = 'General' 
         OR files.department = ? 
         OR ? = 'Executive' OR ? = 'admin'
      ORDER BY files.created_at DESC
    `).bind(userDept, userDept, user.role).all<Pick<DatabaseRows["files"], "id" | "filename" | "file_path" | "uploaded_by" | "department" | "size_bytes" | "created_at"> & {"uploader_name":string}>();

    return NextResponse.json({ 
      files: results, 
      currentUserId: session.userId, 
      currentUserDept: userDept,
      isAdmin, departments 
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const r2 = env.COLLAB_BUCKET; // Access the bound R2 bucket
  const session = await verifySession(request.cookies);
  
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const department = formData.get("department") as string;
    
    if (!(file instanceof File)||!file.size||file.size>25*1024*1024||typeof department!=='string'||!department||department.length>150) return NextResponse.json({ error: "Choose a file up to 25 MB and a department" }, { status: 400 });
    const uploader=await db.prepare('SELECT department, role FROM users WHERE id=?').bind(session.userId).first<Pick<DatabaseRows["users"], "department" | "role">>();
    if(!uploader||(department!=='General'&&department!==uploader.department&&uploader.department!=='Executive'&&uploader.role!=='admin')) return NextResponse.json({error:'You may upload to General or your own department'},{status:403});

    if (!await db.prepare('SELECT id FROM file_departments WHERE id=?').bind(department).first()) return NextResponse.json({error:'Choose an existing department folder.'},{status:400});
    const fileId = crypto.randomUUID();
    const objectKey = `vault/${department.toLowerCase().replace(/[^a-z0-9_-]/g,'_')}/${fileId}-${file.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(-120)}`;
    
    // Point the UI to a secure fetching route instead of a raw storage URL
    const filePath = `/api/storage/${objectKey}`;

    // 1. Upload physical file to R2
    const arrayBuffer = await file.arrayBuffer();
    await r2.put(objectKey, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });

    // 2. Save metadata to D1
    await db.prepare(
      'INSERT INTO files (id, filename, file_path, uploaded_by, department, size_bytes) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(fileId, file.name, filePath, session.userId, department, file.size).run();

    return NextResponse.json({ success: true, fileId });
  } catch (error) {
    console.error("Upload error", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const session = await verifySession(request.cookies);
  
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, filename, department } = await request.json();
    
    // Security check: Must be uploader or Executive
    const user = await db.prepare("SELECT department, role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "department" | "role">>();
    const file = await db.prepare("SELECT uploaded_by FROM files WHERE id = ?").bind(id).first<Pick<DatabaseRows["files"], "uploaded_by">>();
    
    if (!file || (file.uploaded_by !== session.userId && user?.department !== 'Executive' && user?.role !== 'admin')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if(typeof filename!=='string'||!filename.trim()||filename.length>240||typeof department!=='string'||!department||department.length>150) return NextResponse.json({error:'Invalid filename or department'},{status:400});
    if(!user||(department!=='General'&&department!==user.department&&user.department!=='Executive'&&user.role!=='admin')) return NextResponse.json({error:'You may move files to General or your own department'},{status:403});
    if (!await db.prepare('SELECT id FROM file_departments WHERE id=?').bind(department).first()) return NextResponse.json({error:'Choose an existing department folder.'},{status:400});
    await db.prepare("UPDATE files SET filename = ?, department = ? WHERE id = ?")
      .bind(filename, department, id).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  const session = await verifySession(request.cookies);
  
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    // Security check: Must be uploader or Executive
    const user = await db.prepare("SELECT department, role FROM users WHERE id = ?").bind(session.userId).first<Pick<DatabaseRows["users"], "department" | "role">>();
    const file = await db.prepare("SELECT uploaded_by FROM files WHERE id = ?").bind(id).first<Pick<DatabaseRows["files"], "uploaded_by">>();

    if (!file || (file.uploaded_by !== session.userId && user?.department !== 'Executive' && user?.role !== 'admin')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.prepare("DELETE FROM files WHERE id = ?").bind(id).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
