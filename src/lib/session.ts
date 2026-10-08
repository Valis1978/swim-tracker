import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "swim_auth";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;
export type Role = "parent" | "kid";
type AuthEnv = Record<string, string | undefined>;

function credentials(role: Role, env: AuthEnv) {
  const secret = env.AUTH_SECRET;
  const pin = role === "parent" ? env.PARENT_PIN : env.KID_PIN;
  return secret && secret.length >= 32 && pin ? { secret, pin } : null;
}

function equal(a: string, b: string) {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function roleForPin(pin: string, env: AuthEnv = process.env): Role | null {
  for (const role of ["parent", "kid"] as const) {
    const c = credentials(role, env);
    if (c && equal(pin, c.pin)) return role;
  }
  return null;
}

export function roleToken(role: Role, env: AuthEnv = process.env, now = Date.now()): string {
  const c = credentials(role, env);
  if (!c) throw new Error("Authentication is not configured");
  const payload = `v1.${role}.${Math.floor(now / 1000) + SESSION_SECONDS}`;
  // Including the configured PIN in the signature revokes sessions on PIN rotation.
  const signature = createHmac("sha256", c.secret).update(`${payload}.${c.pin}`).digest("hex");
  return `${payload}.${signature}`;
}

export function roleForToken(token: string | undefined, env: AuthEnv = process.env, now = Date.now()): Role | null {
  if (!token || token.length > 128) return null;
  const match = /^v1\.(parent|kid)\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const role = match[1] as Role;
  const c = credentials(role, env);
  const expiry = Number(match[2]), seconds = Math.floor(now / 1000);
  if (!c || expiry <= seconds || expiry > seconds + SESSION_SECONDS) return null;
  const payload = `v1.${role}.${match[2]}`;
  const expected = createHmac("sha256", c.secret).update(`${payload}.${c.pin}`).digest("hex");
  return equal(match[3], expected) ? role : null;
}
