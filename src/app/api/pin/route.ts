import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { pin } = await req.json().catch(() => ({ pin: "" }));
  if (!process.env.FAMILY_PIN || pin !== process.env.FAMILY_PIN) {
    return NextResponse.json({ success: false, error: "Špatný PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
