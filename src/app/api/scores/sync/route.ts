import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { buildScoreUpdates, normalizeScorePayload } from "@/lib/score-sync";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import type { Match } from "@/lib/types";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.SCORE_SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || querySecret === secret;
}

async function fetchScorePayload() {
  const provider = process.env.SCORE_PROVIDER;

  if (provider === "api-football") {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) {
      throw new Error("Missing API_FOOTBALL_KEY.");
    }

    const response = await fetch("https://v3.football.api-sports.io/fixtures?league=1&season=2026", {
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
    throw new Error("Missing SCORE_FEED_URL or SCORE_PROVIDER=api-football.");
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

async function syncScores(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Set SCORE_SYNC_SECRET or CRON_SECRET and call with Authorization: Bearer <secret>." },
      { status: 401 }
    );
  }

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

    const payload = await fetchScorePayload();
    const feedItems = normalizeScorePayload(payload, [...currentMatches.values()]);
    const result = buildScoreUpdates([...currentMatches.values()], feedItems);

    if (result.updates.length > 0) {
      const { error } = await supabase.from("matches").upsert(result.updates.map(matchToRow), { onConflict: "id" });
      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json({
      ok: true,
      provider: process.env.SCORE_PROVIDER || "generic",
      received: feedItems.length,
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
