import { createHash } from "crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "swim_auth";

export type Role = "parent" | "kid";

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "swim-tracker";
}

export function roleToken(role: Role): string {
  const pin = role === "parent" ? process.env.PARENT_PIN : process.env.KID_PIN;
  return hash(`${role}:${pin ?? ""}:${secret()}`);
}

export function roleForPin(pin: string): Role | null {
  if (process.env.PARENT_PIN && pin === process.env.PARENT_PIN) return "parent";
  if (process.env.KID_PIN && pin === process.env.KID_PIN) return "kid";
  return null;
}

// Server-side: resolve the current role from the auth cookie
export async function getRole(): Promise<Role | null> {
  const c = await cookies();
  const v = c.get(AUTH_COOKIE)?.value;
  if (!v) return null;
  if (v === roleToken("parent")) return "parent";
  if (v === roleToken("kid")) return "kid";
  return null;
}

export async function isParent(): Promise<boolean> {
  return (await getRole()) === "parent";
}
