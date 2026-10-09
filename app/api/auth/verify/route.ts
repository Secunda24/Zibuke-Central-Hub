import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/src/modules/auth/session";
import { consumeLoginOtp, OTP_COOKIE, otpCookieOptions } from "@/src/modules/auth/login-otp";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const { otp } = await request.json();
    const token = request.cookies.get(OTP_COOKIE)?.value || "";
    if (typeof otp !== "string" || !env.SESSION_SECRET) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    const userId = await consumeLoginOtp(env.DB,token,otp,env.SESSION_SECRET);
    if (!userId) return NextResponse.json({ error: "Invalid or expired code. After five attempts, request a new code." }, { status: 401 });
    const response = NextResponse.json({ success: true, redirect: "/dashboard" });
    response.cookies.set({ name: SESSION_COOKIE, value: await signSession(userId), ...sessionCookieOptions() });
    response.cookies.set({ name: OTP_COOKIE, value: "", ...otpCookieOptions(), maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 }); }
}
