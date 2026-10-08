import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, roleForPin, roleToken, SESSION_SECONDS } from "@/lib/session";
import { createPinLimiter, readPin } from "@/lib/pin-security";

const takeAttempt = createPinLimiter();

export async function POST(req: NextRequest) {
  const retryAfter = takeAttempt();
  if (retryAfter) return NextResponse.json({ success: false, error: "Příliš mnoho pokusů. Zkus to za 15 minut." }, {
    status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
  const pin = await readPin(req);
  const role = pin ? roleForPin(pin) : null;
  if (!role) {
    return NextResponse.json({ success: false, error: "Špatný PIN" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const res = NextResponse.json({ success: true, role }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(AUTH_COOKIE, roleToken(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    path: "/",
  });
  return res;
}
