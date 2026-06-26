import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { FANTASY_ROUNDS, buildFantasyScoresFromMatches } from "@/lib/fantasy";
import { missingKnownPlayerStatCorrections } from "@/lib/fantasy-stat-corrections";
import { mergePlayerCatalog } from "@/lib/player-catalog";
import { buildScoreUpdates, normalizeScorePayload, teamMatchesName } from "@/lib/score-sync";
import { playerId } from "@/lib/profile-data";
import { INITIAL_MATCHES, getTeam } from "@/lib/tournament-data";
import type { FantasyPlayerMatchScore, Match, PlayerCatalogItem, PlayerMatchStat, Team } from "@/lib/types";

export const runtime = "nodejs";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL?.trim() === "tencent/hy3-preview"
    ? process.env.OPENROUTER_MODEL.trim()
    : "tencent/hy3-preview";

function isMissingPlayerStatsTable(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes("player_match_stats") &&
    (value.includes("could not find") || value.includes("does not exist") || value.includes("schema cache"))
  );
}

function isMissingFantasyScoresTable(message: string) {
  const value = message.toLowerCase();
  return (
    value.includes("fantasy_player_match_scores") &&
    (value.includes("could not find") || value.includes("does not exist") || value.includes("schema cache"))
  );
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.SCORE_SYNC_SECRET || process.env.CRON_SECRET;
  const userAgent = request.headers.get("user-agent");
  if (userAgent === "vercel-cron/1.0") {
    return true;
  }

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || querySecret === secret;
}

async function isFamilyUserRequest(request: NextRequest, supabase: SupabaseClient) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const secret = process.env.SCORE_SYNC_SECRET || process.env.CRON_SECRET;

  if (!token || token === secret) {
    return false;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_key")
    .eq("id", data.user.id)
    .maybeSingle<{ user_key: string }>();
  return profile?.user_key === "tata" || profile?.user_key === "lucas";
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMatchDateKey(keys: Set<string>, match: Match, includeAdjacentDates: boolean) {
  const kickoff = new Date(match.kickoff);
  keys.add(dateKey(kickoff));

  if (includeAdjacentDates) {
    keys.add(dateKey(addDays(kickoff, -1)));
    keys.add(dateKey(addDays(kickoff, 1)));
  }
}

function scoreSyncTargetDates(matches: Match[], force: boolean, now = new Date()) {
  const keys = new Set<string>();
  const nowMs = now.getTime();

  for (const match of matches) {
    if (!match.homeTeamId || !match.awayTeamId || match.updatedBy) {
      continue;
    }

    if (!force) {
      if (isActiveSyncWindow(match, now)) {
        addMatchDateKey(keys, match, false);
      }
      continue;
    }

    const kickoffMs = new Date(match.kickoff).getTime();
    const elapsed = nowMs - kickoffMs;
    const isRecentOrUpcoming = elapsed >= -24 * 60 * 60 * 1000 && elapsed <= 10 * 24 * 60 * 60 * 1000;
    if (isRecentOrUpcoming || match.status === "live") {
      addMatchDateKey(keys, match, true);
    }
  }

  if (force && keys.size === 0) {
    for (const match of matches.filter((item) => item.status !== "final").slice(0, 6)) {
      addMatchDateKey(keys, match, true);
    }
  }

  return [...keys].sort((a, b) => {
    if (!force) {
      return a.localeCompare(b);
    }

    const distanceA = Math.abs(new Date(`${a}T12:00:00.000Z`).getTime() - nowMs);
    const distanceB = Math.abs(new Date(`${b}T12:00:00.000Z`).getTime() - nowMs);
    return distanceA - distanceB || a.localeCompare(b);
  });
}

function readApiFootballErrors(payload: unknown) {
  const record = readEventObject(payload);
  const errors = record?.errors;
  if (!errors) {
    return null;
  }

  if (typeof errors === "string") {
    return errors.trim() || null;
  }

  if (Array.isArray(errors)) {
    const message = errors
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join(" ");
    return message || null;
  }

  if (typeof errors === "object") {
    const message = Object.entries(errors as Record<string, unknown>)
      .map(([key, value]) => {
        if (typeof value === "string") {
          return `${key}: ${value}`;
        }
        if (Array.isArray(value)) {
          return `${key}: ${value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ")}`;
        }
        if (value && typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${String(value)}`;
      })
      .join(" ");
    return message || null;
  }

  return null;
}

function espnDate(date: string) {
  return date.replaceAll("-", "");
}

function espnStatus(value: unknown) {
  const competition = readEventObject(value);
  const status = readEventObject(competition?.status);
  const type = readEventObject(status?.type);
  if (type?.completed === true || type?.state === "post") {
    return "FT";
  }
  if (type?.state === "in") {
    return "live";
  }
  if (typeof type?.shortDetail === "string") {
    return type.shortDetail;
  }
  if (typeof type?.detail === "string") {
    return type.detail;
  }
  if (typeof type?.description === "string") {
    return type.description;
  }
  return "scheduled";
}

function readEspnCompetition(event: unknown) {
  const record = readEventObject(event);
  const competitions = Array.isArray(record?.competitions) ? record.competitions : [];
  return readEventObject(competitions[0]);
}

function readEspnCompetitors(competition: Record<string, unknown> | null) {
  return Array.isArray(competition?.competitors) ? competition.competitors.map(readEventObject).filter(Boolean) : [];
}

function readEspnTeamName(competitor: Record<string, unknown> | null) {
  const team = readEventObject(competitor?.team);
  return typeof team?.displayName === "string"
    ? team.displayName
    : typeof team?.name === "string"
      ? team.name
      : typeof team?.abbreviation === "string"
        ? team.abbreviation
        : "";
}

function readEspnTeamId(competitor: Record<string, unknown> | null) {
  const team = readEventObject(competitor?.team);
  return typeof team?.id === "string" || typeof team?.id === "number" ? String(team.id) : null;
}

function toEspnScoreMatch(event: unknown) {
  const record = readEventObject(event);
  const competition = readEspnCompetition(event);
  if (!record || !competition) {
    return null;
  }

  const competitors = readEspnCompetitors(competition);
  const home = competitors.find((competitor) => competitor?.homeAway === "home") ?? competitors[0] ?? null;
  const away = competitors.find((competitor) => competitor?.homeAway === "away") ?? competitors[1] ?? null;
  const homeTeamName = readEspnTeamName(home);
  const awayTeamName = readEspnTeamName(away);
  if (!homeTeamName || !awayTeamName) {
    return null;
  }

  const homeScore = typeof home?.score === "string" ? Number(home.score) : typeof home?.score === "number" ? home.score : null;
  const awayScore = typeof away?.score === "string" ? Number(away.score) : typeof away?.score === "number" ? away.score : null;

  return {
    provider: "espn",
    providerFixtureId: typeof record.id === "string" || typeof record.id === "number" ? String(record.id) : undefined,
    homeTeamName,
    awayTeamName,
    kickoff: typeof record.date === "string" ? record.date : typeof competition.date === "string" ? competition.date : undefined,
    homeScore: Number.isFinite(homeScore) ? homeScore : null,
    awayScore: Number.isFinite(awayScore) ? awayScore : null,
    status: espnStatus(competition)
  };
}

function toEspnEventRow(event: unknown) {
  const record = readEventObject(event);
  const competition = readEspnCompetition(event);
  const match = toEspnScoreMatch(event);
  if (!record || !competition || !match) {
    return null;
  }

  return {
    eventId: match.providerFixtureId,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    kickoff: match.kickoff,
    competitors: readEspnCompetitors(competition).map((competitor) => ({
      id: readEspnTeamId(competitor),
      name: readEspnTeamName(competitor)
    })),
    details: Array.isArray(competition.details) ? competition.details : []
  };
}

async function fetchEspnScoreboardDate(date: string, force: boolean) {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${espnDate(date)}&limit=100`,
    {
      next: { revalidate: force ? 0 : 300 }
    }
  );

  if (!response.ok) {
    throw new Error(`ESPN returned ${response.status} while checking ${date}.`);
  }

  const payload = await response.json();
  const events = payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).events)
    ? ((payload as Record<string, unknown>).events as unknown[])
    : [];
  return events;
}

async function fetchEspnScorePayload(matches: Match[], force: boolean) {
  const dates = scoreSyncTargetDates(matches, force);
  if (dates.length === 0) {
    return { matches: [], espnEvents: [] };
  }

  const events: unknown[] = [];
  const limitedDates = dates.slice(0, force ? 8 : 1);
  for (const date of limitedDates) {
    events.push(...(await fetchEspnScoreboardDate(date, force)));
  }

  const scoreMatches = events.map(toEspnScoreMatch).filter((item): item is NonNullable<ReturnType<typeof toEspnScoreMatch>> => Boolean(item));
  if (scoreMatches.length === 0) {
    throw new Error(`ESPN returned no FIFA World Cup fixtures for checked dates: ${limitedDates.join(", ")}.`);
  }

  return {
    matches: scoreMatches,
    espnEvents: events.map(toEspnEventRow).filter(Boolean)
  };
}

async function fetchApiFootballFixtureDate(date: string, force: boolean) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("Missing API_FOOTBALL_KEY.");
  }

  const host = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
  const response = await fetch(`https://${host}/fixtures?date=${encodeURIComponent(date)}`, {
    headers: {
      "x-apisports-key": key
    },
    next: { revalidate: force ? 0 : 300 }
  });

  if (!response.ok) {
    throw new Error(`API-Football returned ${response.status} for ${date}.`);
  }

  const payload = await response.json();
  const providerError = readApiFootballErrors(payload);
  if (providerError) {
    throw new Error(`API-Football provider error while checking ${date}: ${providerError}`);
  }

  const items = payload && typeof payload === "object" ? (payload as Record<string, unknown>).response : null;
  return Array.isArray(items) ? items : [];
}

async function fetchApiFootballScorePayload(matches: Match[], force: boolean) {
  const dates = scoreSyncTargetDates(matches, force);
  if (dates.length === 0) {
    return { response: [] };
  }

  const items: unknown[] = [];
  const limitedDates = dates.slice(0, force ? 8 : 1);
  for (const date of limitedDates) {
    items.push(...(await fetchApiFootballFixtureDate(date, force)));
  }

  if (items.length === 0) {
    throw new Error(`API-Football returned no fixtures for checked World Cup match dates: ${limitedDates.join(", ")}.`);
  }

  return { response: items };
}

type ScoreProvider = "espn" | "openrouter" | "api-football";

async function fetchScorePayload(
  matches: Match[],
  force: boolean
): Promise<{ payload: unknown; warnings: string[]; provider: ScoreProvider }> {
  const warnings: string[] = [];

  try {
    return { payload: await fetchEspnScorePayload(matches, force), warnings, provider: "espn" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ESPN score sync failed.";
    warnings.push(`${message} Falling back to confirmed web score lookup.`);
  }

  try {
    return { payload: await fetchOpenRouterScorePayload(matches, force), warnings, provider: "openrouter" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirmed web score lookup failed.";
    warnings.push(`${message} No automatic score changes were applied.`);
    return { payload: { matches: [] }, warnings, provider: "openrouter" };
  }
}

function isForcedSync(request: NextRequest) {
  return request.nextUrl.searchParams.get("force") === "1" || request.headers.get("user-agent") === "vercel-cron/1.0";
}

function isActiveSyncWindow(match: Match, now = new Date()) {
  if (match.status === "live") {
    return true;
  }

  const kickoff = new Date(match.kickoff).getTime();
  const elapsed = now.getTime() - kickoff;
  return elapsed >= -15 * 60 * 1000 && elapsed <= 300 * 60 * 1000;
}

function clampStat(value: number) {
  return Math.max(0, Math.min(20, Math.trunc(value)));
}

function teamScoreForStat(stat: PlayerMatchStat, matchesById: Map<string, Match>) {
  const match = matchesById.get(stat.matchId);
  if (!match || !stat.teamId) {
    return null;
  }
  if (stat.teamId === match.homeTeamId) {
    return match.homeScore;
  }
  if (stat.teamId === match.awayTeamId) {
    return match.awayScore;
  }
  return null;
}

function impossibleStatGroupKey(stat: PlayerMatchStat) {
  return `${stat.matchId}:${stat.teamId}`;
}

function sanitizePlayerStatsForScores(stats: PlayerMatchStat[], matches: Match[]) {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const capped = stats
    .map((stat) => {
      const teamScore = teamScoreForStat(stat, matchesById);
      if (teamScore === null || teamScore === undefined) {
        return stat;
      }
      return { ...stat, goals: Math.min(stat.goals, Math.max(0, teamScore)) };
    })
    .filter((stat) => stat.goals > 0 || stat.assists > 0);

  const goalsByGroup = new Map<string, number>();
  for (const stat of capped) {
    goalsByGroup.set(impossibleStatGroupKey(stat), (goalsByGroup.get(impossibleStatGroupKey(stat)) ?? 0) + stat.goals);
  }

  const droppedGroups = new Set<string>();
  for (const [key, goals] of goalsByGroup) {
    const [matchId, teamId] = key.split(":");
    const teamScore = teamScoreForStat(
      { matchId, teamId, playerId: "", playerName: "", goals: 0, assists: 0 },
      matchesById
    );
    if (teamScore !== null && teamScore !== undefined && goals > teamScore) {
      droppedGroups.add(key);
    }
  }

  return {
    stats: capped.filter((stat) => !droppedGroups.has(impossibleStatGroupKey(stat))),
    droppedGroups: [...droppedGroups].map((key) => {
      const [matchId, teamId] = key.split(":");
      return { matchId, teamId };
    }),
    cappedStats: capped.filter((stat) => {
      const original = stats.find((item) => item.matchId === stat.matchId && item.playerId === stat.playerId);
      return original ? original.goals !== stat.goals || original.assists !== stat.assists : false;
    })
  };
}

function eventTeamForMatch(match: Match, feedTeamName: string) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (home && teamMatchesName(home, feedTeamName)) {
    return home;
  }
  if (away && teamMatchesName(away, feedTeamName)) {
    return away;
  }
  return null;
}

function readEventObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readName(value: unknown) {
  const record = readEventObject(value);
  return typeof record?.name === "string" ? record.name : null;
}

function normalizeEventPlayerName(value: string) {
  return value
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function statKey(matchId: string, playerIdValue: string) {
  return `${matchId}:${playerIdValue}`;
}

function addStat(
  totals: Map<string, PlayerMatchStat>,
  match: Match,
  team: Team,
  rawName: string,
  field: "goals" | "assists",
  count = 1
) {
  const playerName = normalizeEventPlayerName(rawName);
  if (!playerName) {
    return;
  }

  const id = playerId(team.id, playerName);
  const key = statKey(match.id, id);
  const existing =
    totals.get(key) ??
    ({
      matchId: match.id,
      playerId: id,
      playerName,
      teamId: team.id,
      goals: 0,
      assists: 0,
      updatedBy: null,
      updatedAt: new Date().toISOString()
    } satisfies PlayerMatchStat);

  existing[field] += clampStat(count);
  totals.set(key, existing);
}

function parseApiFootballEvents(match: Match, payload: unknown) {
  const items = payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).response)
    ? ((payload as Record<string, unknown>).response as unknown[])
    : [];
  const totals = new Map<string, PlayerMatchStat>();

  for (const item of items) {
    const event = readEventObject(item);
    if (!event) {
      continue;
    }

    const type = typeof event.type === "string" ? event.type.toLowerCase() : "";
    const detail = typeof event.detail === "string" ? event.detail.toLowerCase() : "";
    if (type !== "goal" || detail.includes("own goal")) {
      continue;
    }

    const teamName = readName(event.team);
    const scorerName = readName(event.player);
    const assistName = readName(event.assist);
    if (!teamName || !scorerName) {
      continue;
    }

    const team = eventTeamForMatch(match, teamName);
    if (!team) {
      continue;
    }

    addStat(totals, match, team, scorerName, "goals");
    if (assistName && assistName.toLowerCase() !== "null") {
      addStat(totals, match, team, assistName, "assists");
    }
  }

  return [...totals.values()].map((stat) => ({
    ...stat,
    goals: clampStat(stat.goals),
    assists: clampStat(stat.assists)
  }));
}

type EspnEventRow = {
  eventId?: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoff?: string;
  competitors: Array<{ id: string | null; name: string }>;
  details: unknown[];
};

function readEspnEventRows(payload: unknown) {
  const record = readEventObject(payload);
  return Array.isArray(record?.espnEvents) ? (record.espnEvents as EspnEventRow[]) : [];
}

function espnTeamNameForDetail(row: EspnEventRow, detail: Record<string, unknown>) {
  const team = readEventObject(detail.team);
  const teamId = typeof team?.id === "string" || typeof team?.id === "number" ? String(team.id) : null;
  return row.competitors.find((competitor) => competitor.id === teamId)?.name ?? null;
}

function espnAthleteName(value: unknown) {
  const athlete = readEventObject(value);
  return typeof athlete?.displayName === "string"
    ? athlete.displayName
    : typeof athlete?.fullName === "string"
      ? athlete.fullName
      : null;
}

function parseEspnPlayerStats(matches: Match[], payload: unknown) {
  const totals: PlayerMatchStat[] = [];

  for (const row of readEspnEventRows(payload)) {
    const feedItem = normalizeScorePayload(
      {
        matches: [
          {
            providerFixtureId: row.eventId,
            homeTeamName: row.homeTeamName,
            awayTeamName: row.awayTeamName,
            kickoff: row.kickoff,
            status: "FT"
          }
        ]
      },
      matches
    )[0];
    const match = feedItem?.matchId ? matches.find((item) => item.id === feedItem.matchId) : null;
    if (!match) {
      continue;
    }

    const matchTotals = new Map<string, PlayerMatchStat>();
    for (const value of row.details) {
      const detail = readEventObject(value);
      if (!detail || detail.scoringPlay !== true || detail.ownGoal === true || detail.shootout === true) {
        continue;
      }

      const teamName = espnTeamNameForDetail(row, detail);
      const team = teamName ? eventTeamForMatch(match, teamName) : null;
      const athletes = Array.isArray(detail.athletesInvolved) ? detail.athletesInvolved : [];
      const scorer = espnAthleteName(athletes[0]);
      if (!team || !scorer) {
        continue;
      }

      addStat(matchTotals, match, team, scorer, "goals");
    }

    totals.push(...matchTotals.values());
  }

  return totals.map((stat) => ({
    ...stat,
    goals: clampStat(stat.goals),
    assists: clampStat(stat.assists)
  }));
}

type LlmPlayerStatTarget = {
  match: Match;
  homeName: string;
  awayName: string;
};

function statCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? clampStat(value) : 0;
}

function readTextContent(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const record = readEventObject(value);
  if (record) {
    for (const key of ["text", "content", "output_text", "reasoning"]) {
      if (typeof record[key] === "string") {
        return record[key] as string;
      }
    }

    if (record.parsed && typeof record.parsed === "object") {
      return JSON.stringify(record.parsed);
    }
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const text = value
    .map((part) => {
      const record = readEventObject(part);
      return typeof record?.text === "string" ? record.text : typeof record?.content === "string" ? record.content : "";
    })
    .join("")
    .trim();
  return text || null;
}

function findJsonText(value: unknown, depth = 0): string | null {
  if (depth > 5) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.startsWith("{") || trimmed.startsWith("```") ? trimmed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonText(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const record = readEventObject(value);
  if (!record) {
    return null;
  }

  for (const item of Object.values(record)) {
    const found = findJsonText(item, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

function readOpenRouterContent(data: unknown) {
  const record = readEventObject(data);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const choice = readEventObject(choices[0]);
  const message = readEventObject(choice?.message);

  return (
    readTextContent(message?.content) ||
    readTextContent(message?.reasoning) ||
    readTextContent(message?.parsed) ||
    readTextContent(choice?.text) ||
    findJsonText(message) ||
    findJsonText(choice) ||
    null
  );
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const jsonObject = firstJsonObject(candidate);
    if (jsonObject) {
      return JSON.parse(jsonObject);
    }
    throw new Error("No valid JSON object found.");
  }
}

function firstJsonObject(value: string) {
  const start = value.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseLlmPlayerStats(payload: unknown, targets: LlmPlayerStatTarget[]) {
  const items = payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).matches)
    ? ((payload as Record<string, unknown>).matches as unknown[])
    : [];
  const targetByNumber = new Map(targets.map((target) => [target.match.matchNumber, target]));
  const totals = new Map<string, PlayerMatchStat>();

  for (const item of items) {
    const record = readEventObject(item);
    const matchNumber = typeof record?.matchNumber === "number" ? record.matchNumber : null;
    const target = matchNumber ? targetByNumber.get(matchNumber) : null;
    if (!record || !target) {
      continue;
    }

    const stats = Array.isArray(record.stats) ? record.stats : [];
    for (const row of stats) {
      const stat = readEventObject(row);
      if (!stat || typeof stat.playerName !== "string" || typeof stat.teamName !== "string") {
        continue;
      }

      const team = eventTeamForMatch(target.match, stat.teamName);
      if (!team) {
        continue;
      }

      const goals = statCount(stat.goals);
      const assists = statCount(stat.assists);
      if (goals > 0) {
        addStat(totals, target.match, team, stat.playerName, "goals", goals);
      }
      if (assists > 0) {
        addStat(totals, target.match, team, stat.playerName, "assists", assists);
      }
    }
  }

  return [...totals.values()].map((stat) => ({
    ...stat,
    goals: clampStat(stat.goals),
    assists: clampStat(stat.assists)
  }));
}

async function fetchOpenRouterPlayerStats(targets: LlmPlayerStatTarget[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || targets.length === 0) {
    return [];
  }

  const model = OPENROUTER_MODEL;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "http-referer": process.env.NEXT_PUBLIC_SITE_URL || "https://world-cup-2026-wallchart.vercel.app",
      "x-title": "World Cup 2026 Family Wallchart"
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      plugins: [
        {
          id: "web",
          engine: "exa",
          max_results: 8,
          include_domains: ["fifa.com", "espn.com", "bbc.com", "foxsports.com", "cbssports.com", "apnews.com"]
        }
      ],
      messages: [
        {
          role: "system",
          content:
            "You are a strict football match event extraction service. Use web search when needed. Return only valid JSON. Do not guess. If a scorer or assist is not confirmed, omit it. If assists are not reported by reliable sources, leave assists as 0."
        },
        {
          role: "user",
          content: `Find confirmed goalscorers and assists for these FIFA World Cup 2026 matches only:
${targets
  .map(
    ({ match, homeName, awayName }) =>
      `M${match.matchNumber}: ${homeName} vs ${awayName}, kickoff ${match.kickoff}, current score ${match.homeScore ?? "-"}-${match.awayScore ?? "-"}, status ${match.status}`
  )
  .join("\n")}

Return JSON exactly shaped like:
{"matches":[{"matchNumber":1,"stats":[{"teamName":"Mexico","playerName":"Player Name","goals":1,"assists":0}]}]}
Aggregate duplicate player rows. Use team names from the listed matches. Only include confirmed goals or confirmed assists.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter player stats returned ${response.status}.`);
  }

  const data = await response.json();
  const content = readOpenRouterContent(data);
  if (!content) {
    throw new Error("OpenRouter player stats response did not include text content.");
  }

  try {
    return parseLlmPlayerStats(parseJsonContent(content), targets);
  } catch {
    throw new Error("OpenRouter player stats did not return valid JSON.");
  }
}

function scoredGoalTotal(match: Match) {
  return (match.homeScore ?? 0) + (match.awayScore ?? 0);
}

function statGoalTotalsByMatch(stats: PlayerMatchStat[]) {
  const totals = new Map<string, number>();
  for (const stat of stats) {
    totals.set(stat.matchId, (totals.get(stat.matchId) ?? 0) + stat.goals);
  }
  return totals;
}

function playerStatRepairTargets(matches: Match[], stats: PlayerMatchStat[], force: boolean) {
  const knownGoalsByMatch = statGoalTotalsByMatch(stats);

  return matches
    .filter((match) => {
      if (!match.homeTeamId || !match.awayTeamId || match.status === "scheduled") {
        return false;
      }

      if (!force && !isActiveSyncWindow(match)) {
        return false;
      }

      const matchGoals = scoredGoalTotal(match);
      return matchGoals > 0 && (knownGoalsByMatch.get(match.id) ?? 0) < matchGoals;
    })
    .map((match) => {
      const home = getTeam(match.homeTeamId);
      const away = getTeam(match.awayTeamId);
      if (!home || !away) {
        return null;
      }

      return {
        match,
        homeName: home.name,
        awayName: away.name
      };
    })
    .filter((target): target is LlmPlayerStatTarget => Boolean(target))
    .slice(0, force ? 16 : 4);
}

async function fetchApiFootballFixtureEvents(fixtureId: string) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return null;
  }

  const host = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
  const response = await fetch(`https://${host}/fixtures/events?fixture=${encodeURIComponent(fixtureId)}`, {
    headers: {
      "x-apisports-key": key
    },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`API-Football fixture events returned ${response.status}.`);
  }

  return response.json();
}

function scoreLookupTargets(matches: Match[], force: boolean, now = new Date()) {
  const nowMs = now.getTime();
  const windowStart = nowMs - (force ? 10 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000);
  const windowEnd = nowMs + (force ? 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000);

  return matches
    .filter((match) => {
      if (!match.homeTeamId || !match.awayTeamId || match.updatedBy) {
        return false;
      }

      const kickoff = new Date(match.kickoff).getTime();
      return kickoff >= windowStart && kickoff <= windowEnd;
    })
    .slice(0, force ? 16 : 8);
}

async function fetchOpenRouterScorePayload(matches: Match[], force: boolean) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const model = OPENROUTER_MODEL;
  const now = new Date();
  const targetMatches = scoreLookupTargets(matches, force, now);
  if (targetMatches.length === 0) {
    return { matches: [] };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "http-referer": process.env.NEXT_PUBLIC_SITE_URL || "https://world-cup-2026-wallchart.vercel.app",
      "x-title": "World Cup 2026 Family Wallchart"
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      plugins: [
        {
          id: "web",
          engine: "exa",
          max_results: 5,
          include_domains: ["fifa.com", "espn.com", "bbc.com", "foxsports.com", "cbssports.com"]
        }
      ],
      messages: [
        {
          role: "system",
          content:
            "You are a strict sports score extraction service. Use web search if needed. Return only valid JSON. Do not guess. If a score cannot be confirmed, omit that match."
        },
        {
          role: "user",
          content: `Current time: ${now.toISOString()}.
Find live or final scores for these FIFA World Cup 2026 wallchart matches only:
${targetMatches
  .map((match) => {
    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);
    return `M${match.matchNumber}: ${home?.name ?? match.homeTeamId} vs ${away?.name ?? match.awayTeamId}, kickoff ${match.kickoff}, current wallchart status ${match.status}, current wallchart score ${match.homeScore ?? "-"}-${match.awayScore ?? "-"}`;
  })
  .join("\n")}

Return JSON exactly shaped like:
{"matches":[{"matchNumber":3,"homeScore":1,"awayScore":0,"status":"live"}]}
Allowed status values: scheduled, live, final. Only include confirmed live or final scores. Do not include predictions, odds, previews, or simulated scores.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}.`);
  }

  const data = await response.json();
  const content = readOpenRouterContent(data);
  if (!content) {
    throw new Error("OpenRouter response did not include text content.");
  }

  try {
    return parseJsonContent(content);
  } catch {
    throw new Error("OpenRouter did not return valid JSON.");
  }
}

function matchToRow(match: Match) {
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
    updated_by: null,
    updated_at: match.updatedAt ?? new Date().toISOString()
  };
}

function playerStatToRow(stat: PlayerMatchStat) {
  return {
    match_id: stat.matchId,
    player_id: stat.playerId,
    player_name: stat.playerName,
    team_id: stat.teamId,
    goals: stat.goals,
    assists: stat.assists,
    updated_by: null,
    updated_at: stat.updatedAt ?? new Date().toISOString()
  };
}

function fantasyScoreToRow(score: FantasyPlayerMatchScore) {
  return {
    match_id: score.matchId,
    player_id: score.playerId,
    team_id: score.teamId,
    points: score.points,
    goals: score.goals,
    assists: score.assists,
    clean_sheet: score.cleanSheet,
    yellow_cards: score.yellowCards,
    red_cards: score.redCards,
    own_goals: score.ownGoals,
    penalty_saves: score.penaltySaves,
    penalty_misses: score.penaltyMisses,
    breakdown: score.breakdown,
    status: score.status,
    provider: "espn",
    updated_at: score.updatedAt ?? new Date().toISOString()
  };
}

function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function ensureFantasyRounds(supabase: SupabaseClient) {
  const rows = FANTASY_ROUNDS.map((round) => {
    const matches = INITIAL_MATCHES.filter((match) => round.phases.includes(match.phase)).sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
    );
    const startsAt = matches[0]?.kickoff ?? null;
    const endsAt = matches.at(-1)?.kickoff ? addHours(matches.at(-1)!.kickoff, 3) : null;
    return {
      id: round.id,
      name: round.name,
      starts_at: startsAt,
      locks_at: startsAt,
      ends_at: endsAt
    };
  });

  const { error } = await supabase.from("fantasy_rounds").upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}

function isScheduledZeroPlaceholder(match: Match) {
  return match.status === "scheduled" && match.homeScore === 0 && match.awayScore === 0 && !match.updatedBy;
}

function clearScheduledPlaceholder(match: Match): Match {
  return {
    ...match,
    homeScore: null,
    awayScore: null,
    updatedAt: new Date().toISOString()
  };
}

async function syncScores(request: NextRequest) {
  const force = isForcedSync(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    if (!force) {
      return NextResponse.json({
        ok: true,
        provider: "espn",
        received: 0,
        updated: [],
        playerStatsUpdated: 0,
        warning: "Automatic sync skipped because Supabase server credentials are unavailable."
      });
    }

    return NextResponse.json(
      { ok: false, error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    if (!isAuthorized(request) && !(await isFamilyUserRequest(request, supabase))) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Sign in as Tata/Lucas or call from Vercel Cron." },
        { status: 401 }
      );
    }

    let setupWarning: string | null = null;
    try {
      await ensureFantasyRounds(supabase);
    } catch (error) {
      setupWarning = error instanceof Error ? `Fantasy rounds could not be prepared: ${error.message}` : "Fantasy rounds could not be prepared.";
    }

    const { data: matchRows, error: matchError } = await supabase.from("matches").select("*");
    if (matchError) {
      throw new Error(matchError.message);
    }

    const currentMatches = new Map(INITIAL_MATCHES.map((match) => [match.id, { ...match }]));
    for (const row of matchRows ?? []) {
      const existing = currentMatches.get(row.id);
      if (!existing) {
        continue;
      }

      currentMatches.set(row.id, {
        ...existing,
        homeScore: row.home_score ?? null,
        awayScore: row.away_score ?? null,
        status: row.status ?? "scheduled",
        penaltyWinnerId: row.penalty_winner_id ?? null,
        updatedBy: row.updated_by ? "tata" : null,
        updatedAt: row.updated_at ?? null
      });
    }

    const matchesSnapshot = [...currentMatches.values()];
    const placeholderCleanups = matchesSnapshot.filter(isScheduledZeroPlaceholder).map(clearScheduledPlaceholder);
    if (placeholderCleanups.length > 0) {
      const { error } = await supabase.from("matches").upsert(placeholderCleanups.map(matchToRow), { onConflict: "id" });
      if (error) {
        throw new Error(error.message);
      }

      for (const match of placeholderCleanups) {
        currentMatches.set(match.id, match);
      }
    }

    const cleanedMatchesSnapshot = [...currentMatches.values()];
    const activeMatches = cleanedMatchesSnapshot.filter((match) => isActiveSyncWindow(match));
    if (!force && activeMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        provider: "espn",
        received: 0,
        updated: [],
        playerStatsUpdated: 0,
        cleanedPlaceholders: placeholderCleanups.length,
        skipped: [{ reason: "No matches are in the automatic sync window." }]
      });
    }

    const { payload, warnings, provider } = await fetchScorePayload(cleanedMatchesSnapshot, force);
    const feedItems = normalizeScorePayload(payload, cleanedMatchesSnapshot);
    const result = buildScoreUpdates(cleanedMatchesSnapshot, feedItems);

    if (result.updates.length > 0) {
      const { error } = await supabase.from("matches").upsert(result.updates.map(matchToRow), { onConflict: "id" });
      if (error) {
        throw new Error(error.message);
      }
    }

    const updatedMatchesById = new Map(cleanedMatchesSnapshot.map((match) => [match.id, match]));
    for (const update of result.updates) {
      updatedMatchesById.set(update.id, update);
    }

    const playerStats: PlayerMatchStat[] = [];
    const statWarnings: string[] = [];

    if (provider === "espn") {
      playerStats.push(...parseEspnPlayerStats([...updatedMatchesById.values()], payload));
    } else if (provider === "api-football") {
      statWarnings.push("Fantasy player scorer sync skipped because ESPN was unavailable.");
    }

    let playerStatsUpdated = 0;
    let fantasyScoresUpdated = 0;
    let warning: string | null =
      [setupWarning, ...warnings, ...statWarnings].filter(Boolean).length > 0
        ? [setupWarning, ...warnings, ...statWarnings].filter(Boolean).join(" ")
        : null;

    const espnTouchedMatchIds =
      provider === "espn"
        ? Array.from(
            new Set(
              feedItems
                .map((item) => item.matchId)
                .filter((matchId): matchId is string => Boolean(matchId))
            )
          )
        : [];

    if (espnTouchedMatchIds.length > 0) {
      const { error } = await supabase.from("player_match_stats").delete().in("match_id", espnTouchedMatchIds);
      if (error) {
        warning = [warning, `Old ESPN player stats could not be cleared: ${error.message}`].filter(Boolean).join(" ");
      }
    }

    if (playerStats.length > 0) {
      const { error } = await supabase
        .from("player_match_stats")
        .upsert(playerStats.map(playerStatToRow), { onConflict: "match_id,player_id" });
      if (error) {
        if (isMissingPlayerStatsTable(error.message)) {
          warning = [
            warning,
            "Player stats table is missing in Supabase. Run the player_match_stats SQL once, then press Sync again."
          ]
            .filter(Boolean)
            .join(" ");
        } else {
          throw new Error(error.message);
        }
      } else {
        playerStatsUpdated = playerStats.length;
      }
    }

    const { data: allStatRows, error: allStatsError } = await supabase.from("player_match_stats").select("*");
    if (allStatsError) {
      warning = [warning, `Fantasy stats skipped because player stats could not be read: ${allStatsError.message}`]
        .filter(Boolean)
        .join(" ");
    } else {
      const allPlayerStats: PlayerMatchStat[] = ((allStatRows || []) as Array<{
        match_id: string;
        player_id: string;
        player_name: string;
        team_id: string;
        goals: number;
        assists: number;
        updated_at?: string | null;
      }>).map((row) => ({
        matchId: row.match_id,
        playerId: row.player_id,
        playerName: row.player_name,
        teamId: row.team_id,
        goals: row.goals,
        assists: row.assists,
        updatedAt: row.updated_at ?? null
      }));

      const { data: playerRows, error: playerRowsError } = await supabase
        .from("players")
        .select("id, team_id, name, age, shirt_number, position, photo_url");
      const rawPlayerCatalog: PlayerCatalogItem[] = playerRowsError
        ? []
        : ((playerRows || []) as Array<{
            id: string;
            team_id: string;
            name: string;
            age?: number | null;
            shirt_number?: number | null;
            position: string;
            photo_url?: string | null;
          }>).map((row) => ({
            id: row.id,
            teamId: row.team_id,
            name: row.name,
            age: row.age ?? null,
            shirtNumber: row.shirt_number ?? null,
            position: row.position,
            photoUrl: row.photo_url ?? null
          }));
      const playerCatalog = mergePlayerCatalog(rawPlayerCatalog);
      if (playerRowsError) {
        warning = [warning, `Fantasy catalog fell back to watchlist players: ${playerRowsError.message}`].filter(Boolean).join(" ");
      }

      const currentMatchList = [...updatedMatchesById.values()];
      const sanitized = sanitizePlayerStatsForScores(allPlayerStats, currentMatchList);
      if (sanitized.droppedGroups.length > 0) {
        for (const group of sanitized.droppedGroups) {
          const { error } = await supabase
            .from("player_match_stats")
            .delete()
            .eq("match_id", group.matchId)
            .eq("team_id", group.teamId);
          if (error) {
            warning = [warning, `Impossible player stats could not be cleared: ${error.message}`].filter(Boolean).join(" ");
          }
        }
      }
      const sanitizedCappedStats = sanitized.cappedStats.filter(
        (stat) => !sanitized.droppedGroups.some((group) => group.matchId === stat.matchId && group.teamId === stat.teamId)
      );
      if (sanitizedCappedStats.length > 0) {
        const { error } = await supabase
          .from("player_match_stats")
          .upsert(sanitizedCappedStats.map(playerStatToRow), { onConflict: "match_id,player_id" });
        if (error) {
          warning = [warning, `Impossible player stats could not be capped: ${error.message}`].filter(Boolean).join(" ");
        }
      }
      allPlayerStats.splice(0, allPlayerStats.length, ...sanitized.stats);

      const knownCorrections = missingKnownPlayerStatCorrections(currentMatchList, allPlayerStats, playerCatalog);
      if (knownCorrections.length > 0) {
        const { error } = await supabase
          .from("player_match_stats")
          .upsert(knownCorrections.map(playerStatToRow), { onConflict: "match_id,player_id" });
        if (error) {
          warning = [warning, `Known scorer corrections could not be saved: ${error.message}`].filter(Boolean).join(" ");
        } else {
          allPlayerStats.push(...knownCorrections);
          playerStatsUpdated += knownCorrections.length;
        }
      }

      const repairTargets = playerStatRepairTargets(currentMatchList, allPlayerStats, force);
      if (repairTargets.length > 0) {
        warning = [warning, "Some scorer rows are missing from ESPN and were left blank rather than guessed."]
          .filter(Boolean)
          .join(" ");
      }

      const matchIdsWithStats = new Set(allPlayerStats.map((stat) => stat.matchId));
      const fantasyScoreMatches = currentMatchList.filter(
        (match) =>
          matchIdsWithStats.has(match.id) ||
          (match.status === "final" && match.homeScore !== null && match.awayScore !== null)
      );
      const fantasyScores = buildFantasyScoresFromMatches(fantasyScoreMatches, allPlayerStats, playerCatalog);

      if (fantasyScoreMatches.length > 0) {
        const matchIds = fantasyScoreMatches.map((match) => match.id);
        const { error: deleteFantasyError } = await supabase.from("fantasy_player_match_scores").delete().in("match_id", matchIds);
        if (deleteFantasyError) {
          if (isMissingFantasyScoresTable(deleteFantasyError.message)) {
            warning = [
              warning,
              "Mini-Fantasy tables are missing in Supabase. Run the updated supabase/schema.sql once, then press Sync again."
            ]
              .filter(Boolean)
              .join(" ");
          } else {
            throw new Error(deleteFantasyError.message);
          }
        }
      }

      if (fantasyScores.length > 0) {
        const { error } = await supabase.from("fantasy_player_match_scores").insert(fantasyScores.map(fantasyScoreToRow));
        if (error) {
          if (isMissingFantasyScoresTable(error.message)) {
            warning = [
              warning,
              "Mini-Fantasy tables are missing in Supabase. Run the updated supabase/schema.sql once, then press Sync again."
            ]
              .filter(Boolean)
              .join(" ");
          } else {
            throw new Error(error.message);
          }
        } else {
          fantasyScoresUpdated = fantasyScores.length;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      provider,
      received: feedItems.length,
      playerStatsFound: playerStats.length,
      playerStatsUpdated,
      fantasyScoresUpdated,
      cleanedPlaceholders: placeholderCleanups.length,
      warning,
      updated: result.updates.map((match) => ({
        id: match.id,
        matchNumber: match.matchNumber,
        score: `${match.homeScore ?? "-"}-${match.awayScore ?? "-"}`,
        status: match.status
      })),
      skipped: result.skipped.slice(0, 20)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync scores.";
    if (!force) {
      return NextResponse.json({
        ok: true,
        provider: "espn",
        received: 0,
        updated: [],
        playerStatsUpdated: 0,
        warning: `Automatic sync skipped: ${message}`
      });
    }

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return syncScores(request);
}

export async function POST(request: NextRequest) {
  return syncScores(request);
}
