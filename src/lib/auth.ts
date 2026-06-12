import { createHash } from "crypto";

export const AUTH_COOKIE = "swim_auth";

export function authToken(): string {
  const pin = process.env.FAMILY_PIN ?? "";
  const secret = process.env.AUTH_SECRET ?? "swim-tracker";
  return createHash("sha256").update(`${pin}:${secret}`).digest("hex");
}
