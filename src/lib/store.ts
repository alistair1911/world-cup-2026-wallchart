"use client";

import { INITIAL_MATCHES } from "./tournament-data";
import { getSupabaseClient } from "./supabase";
import { getCurrentAccessToken } from "./auth";
import type { FamilySession, Match, MatchComment, MatchPhase, MatchStatus, Prediction, UserKey } from "./types";

const LOCAL_MATCHES_KEY = "wc26-family-match-overrides";
const LOCAL_PREDICTIONS_KEY = "wc26-family-predictions";
const LOCAL_COMMENTS_KEY = "wc26-family-comments";

type StoredMatchRow = {
  id: string;
  match_number?: number;
  phase?: MatchPhase;
  group_letter?: string | null;
  kickoff?: string;
  venue?: string;
  home_team_id?: string | null;
  away_team_id?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  status?: MatchStatus;
  penalty_winner_id?: string | null;
  updated_at?: string | null;
};

type StoredPredictionRow = {
  user_id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  predicted_winner_team_id?: string | null;
  updated_at?: string | null;
};

type StoredCommentRow = {
  id: string;
  user_id: string;
  match_id: string;
  body: string;
  created_at: string;
};

type StoredProfileRow = {
  id: string;
  user_key: UserKey;
};

export type TournamentState = {
  matches: Match[];
  predictions: Prediction[];
  comments: MatchComment[];
  error?: string;
  commentsError?: string;
};

export type ScoreSyncSummary = {
  ok: boolean;
  provider?: string;
  received?: number;
  updated?: Array<{ id: string; matchNumber: number; score: string; status: string }>;
  error?: string;
};

function readLocalMatches() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_MATCHES_KEY) || "[]") as Partial<Match>[];
  } catch {
    return [];
  }
}

function readLocalPredictions() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_PREDICTIONS_KEY) || "[]") as Prediction[];
  } catch {
    return [];
  }
}

function readLocalComments() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_COMMENTS_KEY) || "[]") as MatchComment[];
  } catch {
    return [];
  }
}

function mergeMatches(overrides: Partial<Match>[]) {
  const byId = new Map(INITIAL_MATCHES.map((match) => [match.id, { ...match }]));

  for (const override of overrides) {
    if (!override.id) {
      continue;
    }

    const existing = byId.get(override.id);
    if (existing) {
      byId.set(override.id, { ...existing, ...override });
    }
  }

  return [...byId.values()].sort((a, b) => a.matchNumber - b.matchNumber);
}

function rowToMatchOverride(row: StoredMatchRow): Partial<Match> {
  return {
    id: row.id,
    homeScore: row.home_score ?? null,
    awayScore: row.away_score ?? null,
    status: row.status ?? "scheduled",
    penaltyWinnerId: row.penalty_winner_id ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function matchToRow(match: Match, session: FamilySession) {
  return {
    id: match.id,
    match_number: match.matchNumber,
    phase: match.phase,
    group_letter: match.group ?? null,
    kickoff: match.kickoff,
    venue: match.venue,
    home_team_id: match.homeTeamId ?? null,
    away_team_id: match.awayTeamId ?? null,
    home_seed_label: match.homeSeed?.label ?? null,
    away_seed_label: match.awaySeed?.label ?? null,
    home_score: match.homeScore,
    away_score: match.awayScore,
    status: match.status,
    penalty_winner_id: match.penaltyWinnerId ?? null,
    updated_by: session.authUserId ?? null,
    updated_at: new Date().toISOString()
  };
}

export async function ensureProfile(session: FamilySession) {
  const supabase = getSupabaseClient();
  if (!supabase || !session.authUserId) {
    return;
  }

  const token = await getCurrentAccessToken();
  if (!token) {
    throw new Error("Missing Supabase session.");
  }

  const response = await fetch("/api/profiles/ensure", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      userKey: session.userKey,
      displayName: session.displayName
    })
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Could not prepare ${session.displayName}'s shared profile.`);
  }
}

export async function loadTournamentState(): Promise<TournamentState> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      matches: mergeMatches(readLocalMatches()),
      predictions: readLocalPredictions(),
      comments: readLocalComments()
    };
  }

  try {
    const [
      { data: matchRows, error: matchError },
      { data: predictionRows, error: predictionError },
      { data: profiles },
      { data: commentRows, error: commentError }
    ] = await Promise.all([
      supabase.from("matches").select("*"),
      supabase.from("predictions").select("*"),
      supabase.from("profiles").select("id, user_key, display_name"),
      supabase.from("comments").select("*").order("created_at", { ascending: true })
    ]);

    if (matchError || predictionError) {
      throw new Error(matchError?.message || predictionError?.message || "Could not load tournament data.");
    }

    const profileMap = new Map(((profiles || []) as StoredProfileRow[]).map((profile) => [profile.id, profile]));

    const predictions: Prediction[] = [];
    for (const row of (predictionRows || []) as StoredPredictionRow[]) {
      const profile = profileMap.get(row.user_id);
      if (!profile) {
        continue;
      }

      predictions.push({
        userKey: profile.user_key,
        matchId: row.match_id,
        homeScore: row.home_score,
        awayScore: row.away_score,
        predictedWinnerTeamId: row.predicted_winner_team_id ?? null,
        updatedAt: row.updated_at ?? null
      });
    }

    const comments: MatchComment[] = [];
    if (!commentError) {
      for (const row of (commentRows || []) as StoredCommentRow[]) {
        const profile = profileMap.get(row.user_id);
        if (!profile) {
          continue;
        }

        comments.push({
          id: row.id,
          userKey: profile.user_key,
          displayName: profile.user_key === "tata" ? "Tata" : "Lucas",
          matchId: row.match_id,
          body: row.body,
          createdAt: row.created_at
        });
      }
    }

    return {
      matches: mergeMatches(((matchRows || []) as StoredMatchRow[]).map(rowToMatchOverride)),
      predictions,
      comments,
      commentsError: commentError?.message
    };
  } catch (error) {
    return {
      matches: INITIAL_MATCHES,
      predictions: [],
      comments: [],
      error: error instanceof Error ? error.message : "Could not load tournament data."
    };
  }
}

export async function saveMatchResult(session: FamilySession, match: Match) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const overrides = readLocalMatches().filter((item) => item.id !== match.id);
    overrides.push({
      id: match.id,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: match.status,
      penaltyWinnerId: match.penaltyWinnerId ?? null,
      updatedBy: session.userKey,
      updatedAt: new Date().toISOString()
    });
    window.localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(overrides));
    return;
  }

  await ensureProfile(session);

  const { error } = await supabase.from("matches").upsert(matchToRow(match, session), { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}

export async function savePrediction(session: FamilySession, prediction: Prediction) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const predictions = readLocalPredictions().filter(
      (item) => !(item.userKey === prediction.userKey && item.matchId === prediction.matchId)
    );
    predictions.push({ ...prediction, updatedAt: new Date().toISOString() });
    window.localStorage.setItem(LOCAL_PREDICTIONS_KEY, JSON.stringify(predictions));
    return;
  }

  if (!session.authUserId) {
    throw new Error("Missing Supabase user.");
  }

  await ensureProfile(session);

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: session.authUserId,
      match_id: prediction.matchId,
      home_score: prediction.homeScore,
      away_score: prediction.awayScore,
      predicted_winner_team_id: prediction.predictedWinnerTeamId ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,match_id" }
  );

  if (error) {
    if (error.message.toLowerCase().includes("comments")) {
      throw new Error("Comments need the updated Supabase schema. Run supabase/schema.sql once in Supabase SQL Editor.");
    }
    throw new Error(error.message);
  }
}

export async function saveComment(session: FamilySession, matchId: string, body: string): Promise<MatchComment> {
  const trimmed = body.trim().slice(0, 280);
  if (!trimmed) {
    throw new Error("Write a comment first.");
  }

  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const comment: MatchComment = {
      id: window.crypto?.randomUUID?.() ?? `${Date.now()}`,
      userKey: session.userKey,
      displayName: session.displayName,
      matchId,
      body: trimmed,
      createdAt: now
    };
    const comments = [...readLocalComments(), comment];
    window.localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
    return comment;
  }

  if (!session.authUserId) {
    throw new Error("Missing Supabase user.");
  }

  await ensureProfile(session);

  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id: session.authUserId,
      match_id: matchId,
      body: trimmed
    })
    .select("id, match_id, body, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    userKey: session.userKey,
    displayName: session.displayName,
    matchId: data.match_id,
    body: data.body,
    createdAt: data.created_at
  };
}

export async function syncLiveScores(): Promise<ScoreSyncSummary> {
  const token = await getCurrentAccessToken();
  const response = await fetch("/api/scores/sync", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as ScoreSyncSummary;

  if (!response.ok) {
    throw new Error(payload.error || "Could not sync live scores.");
  }

  return payload;
}
