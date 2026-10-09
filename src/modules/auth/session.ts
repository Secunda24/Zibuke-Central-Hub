import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { jwtVerify, SignJWT } from "jose";

declare global {
  interface CloudflareEnv {
    SESSION_SECRET?: string;
  }
}

/**
 * Single source of truth for the session cookie.
 *
 * The cookie holds an HS256 JWT signed with the `SESSION_SECRET` Cloudflare
 * secret. It is never a raw user id: every consumer must go through
 * verifySession() so a forged or unsigned value is rejected.
 */

export const SESSION_COOKIE = "zc_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ALGORITHM = "HS256";

export type Session = {
  userId: string;
};

/**
 * A request cookie store: `request.cookies` in a route handler, or the
 * store returned by `await cookies()` in a Server Component.
 */
export type SessionCookieSource = {
  get(name: string): { value: string } | undefined;
};

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export class SessionConfigurationError extends Error {
  constructor() { super("SESSION_SECRET is missing in the Worker configuration"); this.name = "SessionConfigurationError"; }
}

async function getSessionSecret(): Promise<Uint8Array> {
  const { env } = await getCloudflareContext({ async: true });
  let secret = env.SESSION_SECRET;

  // ONLY use the fallback if running locally. This prevents production lockouts.
  if (!secret && process.env.NODE_ENV !== "production") {
    secret = process.env.SESSION_SECRET;
  }

  if (!secret) {
    throw new SessionConfigurationError();
  }

  return new TextEncoder().encode(secret as string);
}

export async function signSession(userId: string): Promise<string> {
  const secret = await getSessionSecret();

  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(
  source: SessionCookieSource,
): Promise<Session | null> {
  const token = source.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const secret = await getSessionSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }

    const {env}=await getCloudflareContext({async:true});
    // Archived (removed) employees lose access immediately: every route resolves its session here.
    const account=await env.DB.prepare('SELECT id,password_updated_at FROM users WHERE id=? AND archived_at IS NULL').bind(payload.sub).first<Pick<DatabaseRows["users"], "id" | "password_updated_at">>();
    if(!account)return null;
    const changedAt=String(account.password_updated_at || '').replace(' ','T');
    const passwordChanged=changedAt?Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(changedAt)?changedAt:changedAt+'Z')/1000:0;
    if(Number.isFinite(passwordChanged)&&passwordChanged>(payload.iat||0))return null;
    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof SessionConfigurationError) console.error(error.message);
    return null;
  }
}

export function sessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
