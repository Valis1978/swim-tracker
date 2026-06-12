import { NextRequest, NextResponse } from "next/server";

// PIN gate for the whole app. /api/sync has its own token; /pin + static assets are open.
let expectedToken: string | null = null;

async function getExpectedToken(): Promise<string> {
  if (expectedToken) return expectedToken;
  const pin = process.env.FAMILY_PIN ?? "";
  const secret = process.env.AUTH_SECRET ?? "swim-tracker";
  const data = new TextEncoder().encode(`${pin}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  expectedToken = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expectedToken;
}

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
  if (!cookie || cookie !== (await getExpectedToken())) {
    const url = req.nextUrl.clone();
    url.pathname = "/pin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
