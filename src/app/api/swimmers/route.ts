import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getProfile, getOutputs } from "@/lib/csps";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

async function authorized(): Promise<boolean> {
  const c = await cookies();
  return c.get(AUTH_COOKIE)?.value === authToken();
}

// Add a swimmer to the watchlist by CSPS userId (from their profile URL on vysledky.czechswimming.cz)
export async function POST(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { cspsUserId } = await req.json().catch(() => ({}));
  const id = Number(cspsUserId);
  if (!id || !Number.isInteger(id)) {
    return NextResponse.json({ success: false, error: "Neplatné ID plavce" }, { status: 400 });
  }
  try {
    const profile = await getProfile(id);
    const outputs = await getOutputs(id).catch(() => []);
    const birthYearGuess = outputs.length ? null : null; // birth year not in profile; backfilled from rankings when seen
    const { data, error } = await db()
      .from("swim_swimmers")
      .upsert(
        {
          csps_user_id: id,
          first_name: profile.firstName,
          last_name: profile.lastName,
          gender: profile.sex,
          birth_year: birthYearGuess,
          club_name: profile.userProfileClubMemberDto?.clubName ?? null,
          source: "manual",
          active: true,
        },
        { onConflict: "csps_user_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, swimmer: data });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ success: false, error: "Chybí id" }, { status: 400 });
  const { error } = await db().from("swim_swimmers").update({ active: false }).eq("id", id).eq("is_primary", false);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
