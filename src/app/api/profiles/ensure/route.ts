import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { UserKey } from "@/lib/types";

export const runtime = "nodejs";

const familyEmails: Record<UserKey, string> = {
  tata: process.env.NEXT_PUBLIC_TATA_EMAIL || "tata@family.local",
  lucas: process.env.NEXT_PUBLIC_LUCAS_EMAIL || "lucas@family.local"
};

function cleanDisplayName(value: unknown, userKey: UserKey) {
  const fallback = userKey === "tata" ? "Tata" : "Lucas";
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().slice(0, 40) || fallback;
}

function userKeyFromBody(value: unknown): UserKey | null {
  return value === "tata" || value === "lucas" ? value : null;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing Supabase login token." }, { status: 401 });
  }

  let body: { userKey?: unknown; displayName?: unknown };
  try {
    body = (await request.json()) as { userKey?: unknown; displayName?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid profile request." }, { status: 400 });
  }

  const userKey = userKeyFromBody(body.userKey);
  if (!userKey) {
    return NextResponse.json({ ok: false, error: "Invalid family user." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
  const { data, error: userError } = await supabase.auth.getUser(token);
  if (userError || !data.user) {
    return NextResponse.json({ ok: false, error: "Supabase session is not valid." }, { status: 401 });
  }

  const expectedEmail = familyEmails[userKey].toLowerCase();
  const actualEmail = data.user.email?.toLowerCase();
  if (actualEmail !== expectedEmail) {
    return NextResponse.json(
      { ok: false, error: `This login cannot claim the ${userKey === "tata" ? "Tata" : "Lucas"} profile.` },
      { status: 403 }
    );
  }

  const profile = {
    id: data.user.id,
    user_key: userKey,
    display_name: cleanDisplayName(body.displayName, userKey)
  };

  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
  if (!error) {
    return NextResponse.json({ ok: true });
  }

  if (error.code === "23505" || error.message.toLowerCase().includes("duplicate key")) {
    const { error: repairError } = await supabase.from("profiles").update(profile).eq("user_key", userKey);
    if (!repairError) {
      return NextResponse.json({ ok: true, repaired: true });
    }

    return NextResponse.json({ ok: false, error: repairError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
}
