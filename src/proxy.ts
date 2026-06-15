import { NextRequest, NextResponse } from "next/server";

// PIN gate with two roles: parent (full app) and kid (only /viki + /zavody).
// /api/sync has its own token; /pin + static assets are open.
const tokens: { parent?: string; kid?: string } = {};

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getTokens(): Promise<{ parent: string; kid: string }> {
  if (!tokens.parent || !tokens.kid) {
    const secret = process.env.AUTH_SECRET ?? "swim-tracker";
    tokens.parent = await sha256Hex(`parent:${process.env.PARENT_PIN ?? ""}:${secret}`);
    tokens.kid = await sha256Hex(`kid:${process.env.KID_PIN ?? ""}:${secret}`);
  }
  return tokens as { parent: string; kid: string };
}

const KID_ALLOWED = ["/viki", "/zavody", "/dalkove"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/pin") ||
    pathname.startsWith("/api/pin") ||
    pathname.startsWith("/api/sync") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icons") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("swim_auth")?.value;
  const t = await getTokens();
  if (cookie === t.parent) return NextResponse.next();
  if (cookie === t.kid) {
    if (pathname === "/" || KID_ALLOWED.some((p) => pathname.startsWith(p))) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/viki";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const url = req.nextUrl.clone();
  url.pathname = "/pin";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
