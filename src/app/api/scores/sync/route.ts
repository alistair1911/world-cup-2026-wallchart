import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { buildScoreUpdates, normalizeScorePayload, teamMatchesName } from "@/lib/score-sync";
import { playerId } from "@/lib/profile-data";
import { INITIAL_MATCHES, getTeam } from "@/lib/tournament-data";
import type { Match, PlayerMatchStat, Team } from "@/lib/types";

export const runtime = "nodejs";

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

async function fetchScorePayload() {
  const provider = (process.env.SCORE_PROVIDER || (process.env.API_FOOTBALL_KEY ? "api-football" : "")).toLowerCase();

  if (provider === "openrouter-llm") {
    return fetchOpenRouterScorePayload();
  }

  if (["api-football", "api-sports", "api-football-v3"].includes(provider)) {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) {
      throw new Error("Missing API_FOOTBALL_KEY.");
    }

    const host = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
    const league = process.env.API_FOOTBALL_LEAGUE_ID || "1";
    const season = process.env.API_FOOTBALL_SEASON || "2026";
    const response = await fetch(`https://${host}/fixtures?league=${league}&season=${season}`, {
      headers: {
        "x-apisports-key": key
      },
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`API-Football returned ${response.status}.`);
    }

    return response.json();
  }

  const feedUrl = process.env.SCORE_FEED_URL;
  if (!feedUrl) {
    throw new Error("Missing SCORE_FEED_URL, API_FOOTBALL_KEY, or SCORE_PROVIDER=openrouter-llm.");
  }

  const headers: Record<string, string> = {};
  if (process.env.SCORE_FEED_TOKEN) {
    headers.authorization = `Bearer ${process.env.SCORE_FEED_TOKEN}`;
  }

  const response = await fetch(feedUrl, { headers, next: { revalidate: 0 } });
  if (!response.ok) {
    throw new Error(`Score feed returned ${response.status}.`);
  }

  return response.json();
}

function isForcedSync(request: NextRequest) {
  return request.nextUrl.searchParams.get("force") === "1";
}

function isActiveSyncWindow(match: Match, now = new Date()) {
  if (match.status === "live") {
    return true;
  }

  const kickoff = new Date(match.kickoff).getTime();
  const elapsed = now.getTime() - kickoff;
  return elapsed >= -10 * 60 * 1000 && elapsed <= 220 * 60 * 1000;
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
  field: "goals" | "assists"
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

  existing[field] += 1;
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

async function fetchOpenRouterScorePayload() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const model = process.env.OPENROUTER_MODEL || "inclusionai/ring-2.6-1t";
  const now = new Date();
  const windowStart = now.getTime() - 8 * 60 * 60 * 1000;
  const windowEnd = now.getTime() + 18 * 60 * 60 * 1000;
  const targetMatches = INITIAL_MATCHES.filter((match) => {
    const kickoff = new Date(match.kickoff).getTime();
    return kickoff >= windowStart && kickoff <= windowEnd;
  }).slice(0, 12);

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
  .map((match) => `M${match.matchNumber}: ${match.homeTeamId ?? match.homeSeed?.label} vs ${match.awayTeamId ?? match.awaySeed?.label}, kickoff ${match.kickoff}`)
  .join("\n")}

Return JSON exactly shaped like:
{"matches":[{"matchNumber":3,"homeScore":1,"awayScore":0,"status":"live"}]}
Allowed status values: scheduled, live, final. Only include confirmed live or final scores.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}.`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response did not include text content.");
  }

  try {
    return JSON.parse(content);
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
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
        updatedAt: row.updated_at ?? null
      });
    }

    const matchesSnapshot = [...currentMatches.values()];
    const force = isForcedSync(request);
    const activeMatches = matchesSnapshot.filter((match) => isActiveSyncWindow(match));
    if (!force && activeMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        provider: process.env.SCORE_PROVIDER || "generic",
        received: 0,
        updated: [],
        playerStatsUpdated: 0,
        skipped: [{ reason: "No matches are in the automatic sync window." }]
      });
    }

    const payload = await fetchScorePayload();
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
    const provider = (process.env.SCORE_PROVIDER || (process.env.API_FOOTBALL_KEY ? "api-football" : "")).toLowerCase();
    if (["api-football", "api-sports", "api-football-v3"].includes(provider)) {
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
        const eventsPayload = await fetchApiFootballFixtureEvents(target.fixtureId);
        if (!eventsPayload) {
          continue;
        }
        playerStats.push(...parseApiFootballEvents(target.match, eventsPayload));
      }
    }

    if (playerStats.length > 0) {
      const { error } = await supabase
        .from("player_match_stats")
        .upsert(playerStats.map(playerStatToRow), { onConflict: "match_id,player_id" });
      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json({
      ok: true,
      provider: process.env.SCORE_PROVIDER || "generic",
      received: feedItems.length,
      playerStatsUpdated: playerStats.length,
      updated: result.updates.map((match) => ({
        id: match.id,
        matchNumber: match.matchNumber,
        score: `${match.homeScore ?? "-"}-${match.awayScore ?? "-"}`,
        status: match.status
      })),
      skipped: result.skipped.slice(0, 20)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not sync scores." },
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
