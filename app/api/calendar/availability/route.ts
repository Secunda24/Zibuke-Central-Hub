import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/src/modules/auth/session";
import { calculateAvailability } from "@/src/modules/calendar/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) return NextResponse.json({ error: "Database binding missing" }, { status: 500 });

  try {
    const body = await request.json();
    const attendeeIds = Array.isArray(body.attendeeIds) ? body.attendeeIds.map(String).filter(Boolean).slice(0, 100) : [];
    const startTime = String(body.startTime || "");
    const endTime = String(body.endTime || "");
    const excludeEventId = body.excludeEventId ? String(body.excludeEventId) : null;
    const participantIds = [...new Set([session.userId, ...attendeeIds.filter((id: string) => id !== session.userId)])];

    const result = await calculateAvailability(db, participantIds, startTime, endTime, excludeEventId, true);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Calendar availability error", error);
    return NextResponse.json({ error: "Could not check availability" }, { status: 500 });
  }
}
