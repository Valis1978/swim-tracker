import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, roleForPin, roleToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { pin } = await req.json().catch(() => ({ pin: "" }));
  const role = roleForPin(String(pin ?? ""));
  if (!role) {
    return NextResponse.json({ success: false, error: "Špatný PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ success: true, role });
  res.cookies.set(AUTH_COOKIE, roleToken(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
