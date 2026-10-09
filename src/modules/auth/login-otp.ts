import crypto from "node:crypto";
import { Resend } from "resend";
export const OTP_COOKIE = "zc_login_challenge";
export const OTP_SECONDS = 600;
export const challengeHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const codeHash = (token: string, code: string, secret: string) => crypto.createHmac("sha256", secret).update(`${token}:${code}`).digest("hex");
export const otpCookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/auth", maxAge: OTP_SECONDS });

export async function beginLoginOtp(db: D1Database, env: {SESSION_SECRET?:string;RESEND_API_KEY?:string;OTP_EMAIL_FROM?:string}, user: { id: string; email: string }) {
  if (!env.RESEND_API_KEY || !env.OTP_EMAIL_FROM || !env.SESSION_SECRET) return { status: 503, error: "Email verification is not configured. Please contact your administrator." };
  const now = Date.now(), token = crypto.randomBytes(32).toString("hex"), code = String(crypto.randomInt(10000000,100000000));
  const tokenHash = challengeHash(token);
  // Atomic reservation enforces resend cooldown and a per-account hourly send limit.
  const result = await db.prepare(`INSERT INTO login_challenges (user_id,token_hash,code_hash,email,expires_at,sent_at,window_start,send_count)
    VALUES (?,?,?,?,?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET
    token_hash=excluded.token_hash,code_hash=excluded.code_hash,email=excluded.email,expires_at=excluded.expires_at,
    attempts=0,sent_at=excluded.sent_at,
    window_start=CASE WHEN login_challenges.window_start<=? THEN excluded.window_start ELSE login_challenges.window_start END,
    send_count=CASE WHEN login_challenges.window_start<=? THEN 1 ELSE login_challenges.send_count+1 END
    WHERE login_challenges.sent_at<=? AND (login_challenges.window_start<=? OR login_challenges.send_count<5)`)
    .bind(user.id,tokenHash,codeHash(token,code,env.SESSION_SECRET),user.email,now+OTP_SECONDS*1000,now,now,now-3600000,now-3600000,now-60000,now-3600000).run();
  if (!result.meta.changes) return { status: 429, error: "Please wait before requesting another code. Maximum five codes per hour." };
  try {
    const sent = await new Resend(env.RESEND_API_KEY).emails.send({
      from: env.OTP_EMAIL_FROM, to: user.email, subject: "Your Zibuke Central verification code",
      text: `Your Zibuke Central sign-in code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    });
    if (sent.error) throw new Error("Delivery failed");
  } catch {
    // Keep throttling counters but invalidate the undelivered challenge.
    await db.prepare("UPDATE login_challenges SET expires_at=0 WHERE user_id=? AND token_hash=?").bind(user.id,tokenHash).run();
    return { status: 503, error: "We could not send your code. Please try again shortly or contact your administrator." };
  }
  return { status: 200, token };
}

export async function consumeLoginOtp(db: D1Database, token: string, code: string, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !/^\d{8}$/.test(code)) return null;
  const hash = challengeHash(token), now = Date.now();
  // Increment before comparing, in one conditional statement, to prevent parallel guess bypasses.
  const challenge = await db.prepare(`UPDATE login_challenges SET attempts=attempts+1
    WHERE token_hash=? AND expires_at>? AND attempts<5 RETURNING user_id,code_hash,email`)
    .bind(hash,now).first<{user_id:string;code_hash:string;email:string}>();
  if (!challenge) return null;
  const actual = Buffer.from(codeHash(token,code,secret),"hex"), expected = Buffer.from(challenge.code_hash,"hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual,expected)) return null;
  // The successful conditional update consumes the code. Only one competing request can win.
  const consumed = await db.prepare("UPDATE login_challenges SET expires_at=0 WHERE token_hash=? AND expires_at>? RETURNING user_id,email").bind(hash,now).first();
  if (!consumed) return null;
  const updated = await db.prepare("UPDATE users SET email_verified_at=datetime('now'),last_login_at=datetime('now') WHERE id=? AND email=? RETURNING id").bind(consumed.user_id,consumed.email).first<{id:string}>();
  return updated?.id || null;
}
