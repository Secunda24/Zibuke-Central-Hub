import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { beginLoginOtp, OTP_COOKIE, otpCookieOptions } from "@/src/modules/auth/login-otp";

import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  SessionConfigurationError,
} from "@/src/modules/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const { email: typedEmail, password: typedPassword } = body;

    // 1. Sanitize the email: remove trailing spaces from mobile keyboards and force lowercase
    const email = typeof typedEmail === "string" ? typedEmail.trim().toLowerCase() : "";

    if (!email || typeof typedPassword !== "string" || !typedPassword || typedPassword.length > 1024) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 2. Fetch user without the missing "password" column
    const user = await db.prepare(
      "SELECT id, email, email_verified_at, password_hash, password_salt, password_iterations, archived_at FROM users WHERE lower(email) = ?"
    ).bind(email).first<Pick<DatabaseRows["users"], "id" | "email" | "email_verified_at" | "password_hash" | "password_salt" | "password_iterations" | "archived_at">>();

    if (!user) {
      return NextResponse.json({ error: "We could not verify those details." }, { status: 401 });
    }

    // 3. Archived (removed) accounts cannot sign in. Same generic response as a bad password,
    // so this never reveals whether the account exists.
    if (user.archived_at) {
      return NextResponse.json({ error: "We could not verify those details." }, { status: 401 });
    }

    // 3b. Verify the password
    let isMatch = false;

    if (!user.password_salt) {
      // If there is no salt, this account is still using the initial plaintext default password
      isMatch = typedPassword === user.password_hash;
    } else {
      // Standard PBKDF2 verification for secured accounts
      const testHash = crypto.pbkdf2Sync(
        typedPassword,
        user.password_salt,
        user.password_iterations,
        64,
        'sha256'
      ).toString('hex');
      
      isMatch = (testHash === user.password_hash);
    }

    if (!isMatch) {
      return NextResponse.json({ error: "We could not verify those details." }, { status: 401 });
    }

    // First sign-in verification must finish before a session can be issued.
    if (String(env.FIRST_LOGIN_OTP_ENABLED) === "true" && !user.email_verified_at) {
      const challenge = await beginLoginOtp(db, env, user);
      if (!challenge.token) return NextResponse.json({ error: challenge.error }, { status: challenge.status });
      const response = NextResponse.json({ requiresOtp: true, message: "A verification code was sent to your account email." });
      response.cookies.set({ name: OTP_COOKIE, value: challenge.token, ...otpCookieOptions() });
      response.cookies.set({ name: SESSION_COOKIE, value: "", ...sessionCookieOptions(), maxAge: 0 });
      return response;
    }
    const sessionToken = await signSession(String(user.id));
    await db.prepare("UPDATE users SET last_login_at=datetime('now') WHERE id=?").bind(user.id).run();
    // 4. Success! Set the session cookie and redirect
    const response = NextResponse.json({ success: true, redirect: "/dashboard" });
    
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      ...sessionCookieOptions(),
    });

    return response;

  } catch (error) {
    console.error("Login Verification Error:", error);
    if (error instanceof SessionConfigurationError) return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please contact your administrator." }, { status: 503 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
