"use client";

import { FAMILY_USERS } from "./tournament-data";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase";
import type { FamilySession, UserKey } from "./types";

const LOCAL_SESSION_KEY = "wc26-family-session";

const familyEmails: Record<UserKey, string> = {
  tata: process.env.NEXT_PUBLIC_TATA_EMAIL || "tata@family.local",
  lucas: process.env.NEXT_PUBLIC_LUCAS_EMAIL || "lucas@family.local"
};

function displayNameFor(userKey: UserKey) {
  return FAMILY_USERS.find((user) => user.key === userKey)?.displayName ?? userKey;
}

function keyFromEmail(email?: string | null): UserKey {
  const normalized = email?.toLowerCase();
  if (normalized === familyEmails.lucas.toLowerCase()) {
    return "lucas";
  }
  return "tata";
}

export function isSupabaseMode() {
  return hasSupabaseConfig();
}

export async function signInFamily(userKey: UserKey, password: string): Promise<FamilySession> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: familyEmails[userKey],
      password
    });

    if (error || !data.user) {
      throw new Error(error?.message || "Could not sign in.");
    }

    return {
      userKey,
      displayName: displayNameFor(userKey),
      authUserId: data.user.id
    };
  }

  const expected = process.env.NEXT_PUBLIC_FAMILY_DEMO_PASSCODE || "worldcup2026";
  if (password !== expected) {
    throw new Error("Wrong family passcode.");
  }

  const session = {
    userKey,
    displayName: displayNameFor(userKey)
  };
  window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function getCurrentSession(): Promise<FamilySession | null> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) {
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_key, display_name")
      .eq("id", authUser.id)
      .maybeSingle();

    const userKey = ((profile?.user_key as UserKey | undefined) || keyFromEmail(authUser.email)) as UserKey;

    return {
      userKey,
      displayName: profile?.display_name || displayNameFor(userKey),
      authUserId: authUser.id
    };
  }

  const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FamilySession;
  } catch {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    return null;
  }
}

export async function getCurrentAccessToken() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signOutFamily() {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  window.localStorage.removeItem(LOCAL_SESSION_KEY);
}
