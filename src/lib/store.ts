"use client";

import { INITIAL_MATCHES } from "./tournament-data";
import { getSupabaseClient } from "./supabase";
import type { FamilySession, Match, MatchPhase, MatchStatus, Prediction, UserKey } from "./types";

const LOCAL_MATCHES_KEY = "wc26-family-match-overrides";
const LOCAL_PREDICTIONS_KEY = "wc26-family-predictions";

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

type StoredProfileRow = {
  id: string;
  user_key: UserKey;
};

export type TournamentState = {
  matches: Match[];
  predictions: Prediction[];
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

export async function loadTournamentState(): Promise<TournamentState> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      matches: mergeMatches(readLocalMatches()),
      predictions: readLocalPredictions()
    };
  }

  try {
    const [{ data: matchRows, error: matchError }, { data: predictionRows, error: predictionError }, { data: profiles }] =
      await Promise.all([
        supabase.from("matches").select("*"),
        supabase.from("predictions").select("*"),
        supabase.from("profiles").select("id, user_key")
      ]);

    if (matchError || predictionError) {
      throw new Error(matchError?.message || predictionError?.message || "Could not load tournament data.");
    }

    const profileMap = new Map(
      ((profiles || []) as StoredProfileRow[]).map((profile) => [profile.id, profile.user_key])
    );

    const predictions: Prediction[] = [];
    for (const row of (predictionRows || []) as StoredPredictionRow[]) {
      const userKey = profileMap.get(row.user_id);
      if (!userKey) {
        continue;
      }

      predictions.push({
        userKey,
        matchId: row.match_id,
        homeScore: row.home_score,
        awayScore: row.away_score,
        predictedWinnerTeamId: row.predicted_winner_team_id ?? null,
        updatedAt: row.updated_at ?? null
      });
    }

    return {
      matches: mergeMatches(((matchRows || []) as StoredMatchRow[]).map(rowToMatchOverride)),
      predictions
    };
  } catch (error) {
    return {
      matches: INITIAL_MATCHES,
      predictions: [],
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
    throw new Error(error.message);
  }
}
