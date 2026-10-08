import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, roleForToken, type Role } from "./session";

export { AUTH_COOKIE, roleForPin, roleToken, SESSION_SECONDS, type Role } from "./session";

export async function getRole(): Promise<Role | null> {
  const c = await cookies();
  return roleForToken(c.get(AUTH_COOKIE)?.value);
}

export async function requireRole(parentOnly = false): Promise<Role> {
  const role = await getRole();
  if (!role) redirect("/pin");
  if (parentOnly && role !== "parent") redirect("/viki");
  return role;
}

export async function isParent(): Promise<boolean> {
  return (await getRole()) === "parent";
}
