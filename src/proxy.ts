import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, roleForToken } from "@/lib/session";

const KID_ALLOWED = ["/viki", "/zavody", "/dalkove", "/rekordy"];
// race detail pages are kid-readable; the page itself only shows her own races
const KID_PATTERNS = [/^\/zavod\/\d{1,9}$/];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname === "/pin" || pathname === "/api/pin" || pathname === "/api/sync" ||
    pathname.startsWith("/_next/") || pathname === "/manifest.json" ||
    pathname.startsWith("/icons/") || pathname === "/favicon.ico"
  ) return NextResponse.next();

  const role = roleForToken(req.cookies.get(AUTH_COOKIE)?.value);
  if (role === "parent") return NextResponse.next();
  if (role === "kid" && (pathname === "/" || KID_ALLOWED.includes(pathname) || KID_PATTERNS.some((p) => p.test(pathname)))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: role ? 403 : 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = req.nextUrl.clone();
  url.pathname = role ? "/viki" : "/pin";
  url.search = "";
  if (!role) url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
