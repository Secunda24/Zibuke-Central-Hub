import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // The session cookie is httpOnly, so only the server can clear it.
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
