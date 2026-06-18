import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { buildScoreUpdates, normalizeScorePayload, teamMatchesName } from "@/lib/score-sync";
import { playerId } from "@/lib/profile-data";
import { INITIAL_MATCHES, getTeam } from "@/lib/tournament-data";
import type { Match, PlayerMatchStat, Team } from "@/lib/types";

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
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join(" ");
    return message || null;
  }

  return null;
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
    throw new Error(`API-Football error for ${date}: ${providerError}`);
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

async function fetchScorePayload(matches: Match[], force: boolean) {
  const warnings: string[] = [];

  try {
    return { payload: await fetchApiFootballScorePayload(matches, force), warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "API-Football score sync failed.";
    warnings.push(`${message} Falling back to confirmed web score lookup.`);
  }

  try {
    return { payload: await fetchOpenRouterScorePayload(matches, force), warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirmed web score lookup failed.";
    warnings.push(`${message} No automatic score changes were applied.`);
    return { payload: { matches: [] }, warnings };
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
  return JSON.parse(fenced ? fenced[1] : trimmed);
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

async function syncScores(request: NextRequest) {
  const force = isForcedSync(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    if (!force) {
      return NextResponse.json({
        ok: true,
        provider: "api-football",
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
    const activeMatches = matchesSnapshot.filter((match) => isActiveSyncWindow(match));
    if (!force && activeMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        provider: "api-football",
        received: 0,
        updated: [],
        playerStatsUpdated: 0,
        skipped: [{ reason: "No matches are in the automatic sync window." }]
      });
    }

    const { payload, warnings } = await fetchScorePayload(matchesSnapshot, force);
    const feedItems = normalizeScorePayload(payload, matchesSnapshot);
    const result = buildScoreUpdates(matchesSnapshot, feedItems);

    if (result.updates.length > 0) {
      const { error } = await supabase.from("matches").upsert(result.updates.map(matchToRow), { onConflict: "id" });
      if (error) {
        throw new Error(error.message);
      }
    }

    const updatedMatchesById = new Map(matchesSnapshot.map((match) => [match.id, match]));
    for (const update of result.updates) {
      updatedMatchesById.set(update.id, update);
    }

    const playerStats: PlayerMatchStat[] = [];
    const statWarnings: string[] = [];
    const eventTargets = feedItems
      .map((item) => ({
        fixtureId: item.providerFixtureId,
        match: item.matchId ? updatedMatchesById.get(item.matchId) : null
      }))
      .filter((target): target is { fixtureId: string; match: Match } =>
        Boolean(target.fixtureId && target.match && (force || isActiveSyncWindow(target.match)) && target.match.status !== "scheduled")
      )
      .slice(0, 6);

    for (const target of eventTargets) {
      try {
        const eventsPayload = await fetchApiFootballFixtureEvents(target.fixtureId);
        if (!eventsPayload) {
          continue;
        }
        playerStats.push(...parseApiFootballEvents(target.match, eventsPayload));
      } catch (error) {
        statWarnings.push(error instanceof Error ? error.message : "API-Football fixture events sync failed.");
      }
    }

    let playerStatsUpdated = 0;
    let warning: string | null = [...warnings, ...statWarnings].length > 0 ? [...warnings, ...statWarnings].join(" ") : null;

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

    return NextResponse.json({
      ok: true,
      provider: "api-football",
      received: feedItems.length,
      playerStatsFound: playerStats.length,
      playerStatsUpdated,
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
        provider: "api-football",
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
