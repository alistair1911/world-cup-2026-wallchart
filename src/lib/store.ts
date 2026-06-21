"use client";

import { INITIAL_MATCHES } from "./tournament-data";
import { FANTASY_ROUND_ID, normalizeFantasyRosterSlots } from "./fantasy";
import { getSupabaseClient } from "./supabase";
import { getCurrentAccessToken } from "./auth";
import type {
  FamilySession,
  FantasyPlayerMatchScore,
  FantasyRosterSlot,
  FantasyTeamSetting,
  Match,
  MatchComment,
  MatchPhase,
  MatchStatus,
  PlayerCatalogItem,
  PlayerMatchStat,
  Prediction,
  UserKey
} from "./types";

const LOCAL_MATCHES_KEY = "wc26-family-match-overrides";
const LOCAL_PREDICTIONS_KEY = "wc26-family-predictions";
const LOCAL_COMMENTS_KEY = "wc26-family-comments";
const LOCAL_PLAYER_STATS_KEY = "wc26-family-player-stats";
const LOCAL_FANTASY_ROSTERS_KEY = "wc26-family-fantasy-rosters";
const LOCAL_FANTASY_SCORES_KEY = "wc26-family-fantasy-scores";
const LOCAL_FANTASY_TEAMS_KEY = "wc26-family-fantasy-teams";
const LOCAL_MIGRATION_KEY = "wc26-family-local-migrated";

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

type StoredPlayerStatRow = {
  match_id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  goals: number;
  assists: number;
  updated_by?: string | null;
  updated_at?: string | null;
};

type StoredPlayerRow = {
  id: string;
  team_id: string;
  name: string;
  age?: number | null;
  shirt_number?: number | null;
  position: string;
  photo_url?: string | null;
};

type StoredFantasyRosterRow = {
  user_id: string;
  round_id: string;
  player_id: string;
  slot_index: number;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  updated_at?: string | null;
};

type StoredFantasyTeamRow = {
  user_id: string;
  name: string;
  formation?: string | null;
  updated_at?: string | null;
};

type StoredFantasyScoreRow = {
  match_id: string;
  player_id: string;
  team_id: string;
  points: number;
  goals: number;
  assists: number;
  clean_sheet: boolean;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  penalty_saves: number;
  penalty_misses: number;
  breakdown?: Record<string, number> | null;
  status?: "confirmed" | "needs_review" | null;
  updated_at?: string | null;
};

type StoredProfileRow = {
  id: string;
  user_key: UserKey;
};

type PlayerCatalogPayload = {
  ok?: boolean;
  players?: PlayerCatalogItem[];
  error?: string;
  warning?: string | null;
};

export type TournamentState = {
  matches: Match[];
  predictions: Prediction[];
  comments: MatchComment[];
  playerStats: PlayerMatchStat[];
  playerCatalog: PlayerCatalogItem[];
  fantasyTeams: FantasyTeamSetting[];
  fantasyRosters: FantasyRosterSlot[];
  fantasyScores: FantasyPlayerMatchScore[];
  error?: string;
  commentsError?: string;
  playerStatsError?: string;
  fantasyError?: string;
};

export type ScoreSyncSummary = {
  ok: boolean;
  provider?: string;
  received?: number;
  updated?: Array<{ id: string; matchNumber: number; score: string; status: string }>;
  playerStatsFound?: number;
  playerStatsUpdated?: number;
  fantasyScoresUpdated?: number;
  cleanedPlaceholders?: number;
  warning?: string | null;
  error?: string;
};

export type LocalMigrationSummary = {
  predictions: number;
  comments: number;
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

function readLocalPlayerStats() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_PLAYER_STATS_KEY) || "[]") as PlayerMatchStat[];
  } catch {
    return [];
  }
}

function readLocalFantasyRosters() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_FANTASY_ROSTERS_KEY) || "[]") as FantasyRosterSlot[];
  } catch {
    return [];
  }
}

function readLocalFantasyTeams() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_FANTASY_TEAMS_KEY) || "[]") as FantasyTeamSetting[];
  } catch {
    return [];
  }
}

function readLocalFantasyScores() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_FANTASY_SCORES_KEY) || "[]") as FantasyPlayerMatchScore[];
  } catch {
    return [];
  }
}

async function fetchPlayerCatalogRows() {
  try {
    const response = await fetch("/api/fantasy/players", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as PlayerCatalogPayload;
    if (!response.ok || payload.ok === false) {
      return {
        data: [] as StoredPlayerRow[],
        error: { message: payload.error || "Could not load Fantasy player catalog." }
      };
    }

    return {
      data: (payload.players ?? []).map((player) => ({
        id: player.id,
        team_id: player.teamId,
        name: player.name,
        age: player.age ?? null,
        shirt_number: player.shirtNumber ?? null,
        position: player.position,
        photo_url: player.photoUrl ?? null
      })),
      error: payload.warning ? { message: payload.warning } : null
    };
  } catch (error) {
    return {
      data: [] as StoredPlayerRow[],
      error: { message: error instanceof Error ? error.message : "Could not load Fantasy player catalog." }
    };
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

export async function ensureProfileBestEffort(session: FamilySession) {
  try {
    await ensureProfile(session);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Could not prepare shared profile.";
  }
}

export async function migrateLocalFamilyData(session: FamilySession): Promise<LocalMigrationSummary> {
  const supabase = getSupabaseClient();
  if (!supabase || !session.authUserId) {
    return { predictions: 0, comments: 0 };
  }

  const localPredictions = readLocalPredictions().filter((prediction) => prediction.userKey === session.userKey);
  const localComments = readLocalComments().filter((comment) => comment.userKey === session.userKey);
  const migrationKey = `${LOCAL_MIGRATION_KEY}-${session.authUserId}`;
  const commentsAlreadyMigrated = window.localStorage.getItem(migrationKey) === "true";

  if (localPredictions.length === 0 && (localComments.length === 0 || commentsAlreadyMigrated)) {
    return { predictions: 0, comments: 0 };
  }

  await ensureProfileBestEffort(session);

  if (localPredictions.length > 0) {
    const { error } = await supabase.from("predictions").upsert(
      localPredictions.map((prediction) => ({
        user_id: session.authUserId,
        match_id: prediction.matchId,
        home_score: prediction.homeScore,
        away_score: prediction.awayScore,
        predicted_winner_team_id: prediction.predictedWinnerTeamId ?? null,
        updated_at: prediction.updatedAt ?? new Date().toISOString()
      })),
      { onConflict: "user_id,match_id" }
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  if (localComments.length > 0 && !commentsAlreadyMigrated) {
    const { error } = await supabase.from("comments").insert(
      localComments.map((comment) => ({
        user_id: session.authUserId,
        match_id: comment.matchId,
        body: comment.body,
        created_at: comment.createdAt
      }))
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  window.localStorage.setItem(migrationKey, "true");
  return {
    predictions: localPredictions.length,
    comments: commentsAlreadyMigrated ? 0 : localComments.length
  };
}

export async function loadTournamentState(): Promise<TournamentState> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      matches: mergeMatches(readLocalMatches()),
      predictions: readLocalPredictions(),
      comments: readLocalComments(),
      playerStats: readLocalPlayerStats(),
      playerCatalog: [],
      fantasyTeams: readLocalFantasyTeams(),
      fantasyRosters: readLocalFantasyRosters(),
      fantasyScores: readLocalFantasyScores()
    };
  }

  try {
    const [
      { data: matchRows, error: matchError },
      { data: predictionRows, error: predictionError },
      { data: profiles },
      { data: commentRows, error: commentError },
      { data: playerStatRows, error: playerStatsError },
      { data: playerRows, error: playerCatalogError },
      { data: fantasyTeamRows, error: fantasyTeamError },
      { data: fantasyRosterRows, error: fantasyRosterError },
      { data: fantasyScoreRows, error: fantasyScoreError }
    ] = await Promise.all([
      supabase.from("matches").select("*"),
      supabase.from("predictions").select("*"),
      supabase.from("profiles").select("id, user_key, display_name"),
      supabase.from("comments").select("*").order("created_at", { ascending: true }),
      supabase.from("player_match_stats").select("*"),
      fetchPlayerCatalogRows(),
      supabase.from("fantasy_teams").select("*"),
      supabase.from("fantasy_rosters").select("*").order("slot_index", { ascending: true }),
      supabase.from("fantasy_player_match_scores").select("*")
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

    const playerStats: PlayerMatchStat[] = [];
    if (!playerStatsError) {
      for (const row of (playerStatRows || []) as StoredPlayerStatRow[]) {
        const profile = row.updated_by ? profileMap.get(row.updated_by) : null;
        playerStats.push({
          matchId: row.match_id,
          playerId: row.player_id,
          playerName: row.player_name,
          teamId: row.team_id,
          goals: row.goals,
          assists: row.assists,
          updatedBy: profile?.user_key ?? null,
          updatedAt: row.updated_at ?? null
        });
      }
    }

    const fantasyRosters: FantasyRosterSlot[] = [];
    if (!fantasyRosterError) {
      for (const row of (fantasyRosterRows || []) as StoredFantasyRosterRow[]) {
        const profile = profileMap.get(row.user_id);
        if (!profile) {
          continue;
        }

        fantasyRosters.push({
          userKey: profile.user_key,
          playerId: row.player_id,
          roundId: row.round_id,
          slotIndex: row.slot_index,
          isStarter: row.is_starter,
          isCaptain: row.is_captain,
          isViceCaptain: row.is_vice_captain,
          updatedAt: row.updated_at ?? null
        });
      }
    }

    const fantasyTeams: FantasyTeamSetting[] = [];
    if (!fantasyTeamError) {
      for (const row of (fantasyTeamRows || []) as StoredFantasyTeamRow[]) {
        const profile = profileMap.get(row.user_id);
        if (!profile) {
          continue;
        }

        fantasyTeams.push({
          userKey: profile.user_key,
          name: row.name,
          formation: row.formation ?? "4-3-3",
          updatedAt: row.updated_at ?? null
        });
      }
    }

    const fantasyScores: FantasyPlayerMatchScore[] = [];
    if (!fantasyScoreError) {
      for (const row of (fantasyScoreRows || []) as StoredFantasyScoreRow[]) {
        fantasyScores.push({
          matchId: row.match_id,
          playerId: row.player_id,
          teamId: row.team_id,
          points: row.points,
          goals: row.goals,
          assists: row.assists,
          cleanSheet: row.clean_sheet,
          yellowCards: row.yellow_cards,
          redCards: row.red_cards,
          ownGoals: row.own_goals,
          penaltySaves: row.penalty_saves,
          penaltyMisses: row.penalty_misses,
          breakdown: row.breakdown ?? {},
          status: row.status ?? "confirmed",
          updatedAt: row.updated_at ?? null
        });
      }
    }

    const playerCatalog: PlayerCatalogItem[] = [];
    if (!playerCatalogError) {
      for (const row of (playerRows || []) as StoredPlayerRow[]) {
        playerCatalog.push({
          id: row.id,
          teamId: row.team_id,
          name: row.name,
          age: row.age ?? null,
          shirtNumber: row.shirt_number ?? null,
          position: row.position,
          photoUrl: row.photo_url ?? null
        });
      }
    }

    return {
      matches: mergeMatches(((matchRows || []) as StoredMatchRow[]).map(rowToMatchOverride)),
      predictions,
      comments,
      playerStats,
      playerCatalog,
      fantasyTeams,
      fantasyRosters,
      fantasyScores,
      commentsError: commentError?.message,
      playerStatsError: playerStatsError?.message,
      fantasyError: fantasyTeamError?.message ?? fantasyRosterError?.message ?? fantasyScoreError?.message
    };
  } catch (error) {
    return {
      matches: INITIAL_MATCHES,
      predictions: [],
      comments: [],
      playerStats: [],
      playerCatalog: [],
      fantasyTeams: [],
      fantasyRosters: [],
      fantasyScores: [],
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

  await ensureProfileBestEffort(session);

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

  await ensureProfileBestEffort(session);

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

  await ensureProfileBestEffort(session);

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

export async function savePlayerStats(session: FamilySession, matchId: string, stats: PlayerMatchStat[]) {
  const cleaned = stats
    .map((stat) => ({
      ...stat,
      matchId,
      goals: Math.max(0, Math.min(20, Math.trunc(stat.goals || 0))),
      assists: Math.max(0, Math.min(20, Math.trunc(stat.assists || 0))),
      updatedBy: session.userKey,
      updatedAt: new Date().toISOString()
    }))
    .filter((stat) => stat.goals > 0 || stat.assists > 0);

  const supabase = getSupabaseClient();

  if (!supabase) {
    const existing = readLocalPlayerStats().filter((item) => item.matchId !== matchId);
    window.localStorage.setItem(LOCAL_PLAYER_STATS_KEY, JSON.stringify([...existing, ...cleaned]));
    return;
  }

  if (!session.authUserId) {
    throw new Error("Missing Supabase user.");
  }

  await ensureProfileBestEffort(session);

  const { error: deleteError } = await supabase.from("player_match_stats").delete().eq("match_id", matchId);
  if (deleteError) {
    if (deleteError.message.toLowerCase().includes("player_match_stats")) {
      throw new Error("Player stats need the updated Supabase schema. Run supabase/schema.sql once in Supabase SQL Editor.");
    }
  }

  if (cleaned.length === 0) {
    return;
  }

  const rows = cleaned.map((stat) => ({
    match_id: stat.matchId,
    player_id: stat.playerId,
    player_name: stat.playerName,
    team_id: stat.teamId,
    goals: stat.goals,
    assists: stat.assists,
    updated_by: session.authUserId,
    updated_at: new Date().toISOString()
  }));
  const { error } = deleteError
    ? await supabase.from("player_match_stats").upsert(rows, { onConflict: "match_id,player_id" })
    : await supabase.from("player_match_stats").insert(rows);

  if (error) {
    if (error.message.toLowerCase().includes("player_match_stats")) {
      throw new Error("Player stats need the updated Supabase schema. Run supabase/schema.sql once in Supabase SQL Editor.");
    }
    throw new Error(error.message);
  }
}

export async function saveFantasyRoster(session: FamilySession, slots: FantasyRosterSlot[]) {
  const cleaned = normalizeFantasyRosterSlots(slots.slice(0, 15), session.userKey).map((slot) => ({
    ...slot,
    updatedAt: new Date().toISOString()
  }));

  const captainIndex = cleaned.findIndex((slot) => slot.isCaptain);
  if (captainIndex >= 0) {
    for (const [index, slot] of cleaned.entries()) {
      slot.isCaptain = index === captainIndex;
    }
  }

  const viceIndex = cleaned.findIndex((slot) => slot.isViceCaptain && !slot.isCaptain);
  if (viceIndex >= 0) {
    for (const [index, slot] of cleaned.entries()) {
      slot.isViceCaptain = index === viceIndex;
    }
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    const otherUsers = readLocalFantasyRosters().filter((slot) => slot.userKey !== session.userKey);
    window.localStorage.setItem(LOCAL_FANTASY_ROSTERS_KEY, JSON.stringify([...otherUsers, ...cleaned]));
    return cleaned;
  }

  if (!session.authUserId) {
    throw new Error("Missing Supabase user.");
  }

  await ensureProfileBestEffort(session);

  const { error: teamError } = await supabase.from("fantasy_teams").upsert(
    {
      user_id: session.authUserId,
      name: `${session.displayName}'s Mini-Fantasy`
    },
    { onConflict: "user_id" }
  );

  if (teamError) {
    throw new Error(teamError.message);
  }

  const { error: deleteError } = await supabase
    .from("fantasy_rosters")
    .delete()
    .eq("user_id", session.authUserId)
    .eq("round_id", FANTASY_ROUND_ID);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (cleaned.length === 0) {
    return cleaned;
  }

  const { error } = await supabase.from("fantasy_rosters").insert(
    cleaned.map((slot) => ({
      user_id: session.authUserId,
      round_id: slot.roundId,
      player_id: slot.playerId,
      slot_index: slot.slotIndex,
      is_starter: slot.isStarter,
      is_captain: slot.isCaptain,
      is_vice_captain: slot.isViceCaptain
    }))
  );

  if (error) {
    if (error.message.toLowerCase().includes("fantasy_rosters")) {
      throw new Error("Mini-Fantasy needs the updated Supabase schema. Run supabase/schema.sql once in Supabase SQL Editor.");
    }
    throw new Error(error.message);
  }

  return cleaned;
}

export async function saveFantasyTeamSettings(
  session: FamilySession,
  settings: Pick<FantasyTeamSetting, "formation">
): Promise<FantasyTeamSetting> {
  const saved: FantasyTeamSetting = {
    userKey: session.userKey,
    name: `${session.displayName}'s Mini-Fantasy`,
    formation: settings.formation || "4-3-3",
    updatedAt: new Date().toISOString()
  };

  const supabase = getSupabaseClient();

  if (!supabase) {
    const otherTeams = readLocalFantasyTeams().filter((team) => team.userKey !== session.userKey);
    window.localStorage.setItem(LOCAL_FANTASY_TEAMS_KEY, JSON.stringify([...otherTeams, saved]));
    return saved;
  }

  if (!session.authUserId) {
    throw new Error("Missing Supabase user.");
  }

  await ensureProfileBestEffort(session);

  const { error } = await supabase.from("fantasy_teams").upsert(
    {
      user_id: session.authUserId,
      name: saved.name,
      formation: saved.formation,
      updated_at: saved.updatedAt
    },
    { onConflict: "user_id" }
  );

  if (error) {
    if (error.message.toLowerCase().includes("formation")) {
      throw new Error("Fantasy formations need the updated Supabase schema. Run supabase/schema.sql once in Supabase SQL Editor.");
    }
    throw new Error(error.message);
  }

  return saved;
}

export async function syncLiveScores(force = true): Promise<ScoreSyncSummary> {
  const token = await getCurrentAccessToken();
  const response = await fetch(`/api/scores/sync${force ? "?force=1" : ""}`, {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as ScoreSyncSummary;

  if (!response.ok) {
    throw new Error(payload.error || "Could not sync live scores.");
  }

  return payload;
}
