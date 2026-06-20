import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  COMPLETE_SQUAD_MINIMUM,
  ESPN_PREFERRED_TEAM_IDS,
  fetchEspnRoster,
  playerCatalogId
} from "@/lib/player-catalog";
import { getTeam } from "@/lib/tournament-data";
import type { PlayerCatalogItem } from "@/lib/types";

type ApiFootballTeamSearch = {
  response?: Array<{
    team?: {
      id?: number;
      name?: string;
      country?: string;
      national?: boolean;
      logo?: string;
    };
  }>;
};

type ApiFootballSquad = {
  response?: Array<{
    team?: {
      id?: number;
      name?: string;
      logo?: string;
    };
    players?: Array<{
      id?: number;
      name?: string;
      age?: number;
      number?: number | null;
      position?: string;
      photo?: string;
    }>;
  }>;
};

type SquadPlayer = {
  id: string;
  name: string;
  age: number | null;
  number: number | null;
  position: string;
  photoUrl: string | null;
};

type TeamSquadRow = {
  team_id: string;
  provider: string;
  provider_team_id: number | null;
  provider_team_name: string | null;
  provider_logo_url: string | null;
  formation: string | null;
  players: SquadPlayer[];
  source: string;
  fetched_at: string;
};

type PlayerRow = {
  id: string;
  team_id: string;
  name: string;
  age: number | null;
  shirt_number: number | null;
  position: string;
  photo_url: string | null;
  provider: string;
  provider_player_id: string | null;
  source: string;
};

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" };
const PARTIAL_HEADERS = { "Cache-Control": "no-store" };

const TEAM_SEARCH_NAMES: Record<string, string> = {
  "bosnia-herzegovina": "Bosnia and Herzegovina",
  "cabo-verde": "Cape Verde",
  "congo-dr": "Congo DR",
  "cote-divoire": "Ivory Coast",
  "curacao": "Curaçao",
  czechia: "Czech Republic",
  "ir-iran": "Iran",
  "korea-republic": "South Korea",
  "new-zealand": "New Zealand",
  "saudi-arabia": "Saudi Arabia",
  "south-africa": "South Africa",
  turkiye: "Turkey",
  usa: "USA"
};

const FORMATIONS = ["4-3-3", "4-2-3-1", "3-4-2-1", "4-4-2"];

function formationForTeam(team: { id: string; seed: number; group: string }) {
  if (team.id === "spain") {
    return "4-3-3";
  }

  return FORMATIONS[(team.seed + team.group.charCodeAt(0)) % FORMATIONS.length];
}

function apiHeaders() {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return null;
  }

  return {
    "x-apisports-key": key
  };
}

async function fetchApiFootball<T>(path: string): Promise<T> {
  const host = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
  const headers = apiHeaders();
  if (!headers) {
    throw new Error("Missing API_FOOTBALL_KEY.");
  }

  const response = await fetch(`https://${host}${path}`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API-Football returned ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isCompleteSquad(players: SquadPlayer[] | null | undefined) {
  return Array.isArray(players) && players.length >= COMPLETE_SQUAD_MINIMUM;
}

function playerRowsToSquadPlayers(rows: PlayerRow[]): SquadPlayer[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    age: row.age,
    number: row.shirt_number,
    position: row.position,
    photoUrl: row.photo_url
  }));
}

async function readSavedSquad(supabase: SupabaseClient | null, teamId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("team_squads").select("*").eq("team_id", teamId).maybeSingle();
  if (error || !data) {
    return null;
  }

  const row = data as TeamSquadRow;
  return isCompleteSquad(row.players) ? row : null;
}

async function readSavedPlayers(supabase: SupabaseClient | null, teamId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, team_id, name, age, shirt_number, position, photo_url, provider, provider_player_id, source")
    .eq("team_id", teamId)
    .order("position", { ascending: true })
    .order("shirt_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  return playerRowsToSquadPlayers(data as PlayerRow[]);
}

async function saveSquad(
  supabase: SupabaseClient | null,
  input: {
    teamId: string;
    provider: string;
    source: string;
    providerTeamId: number | null;
    providerTeamName: string | null;
    providerLogoUrl: string | null;
    formation: string;
    players: SquadPlayer[];
  }
) {
  if (!supabase || !isCompleteSquad(input.players)) {
    return;
  }

  await supabase.from("team_squads").upsert(
    {
      team_id: input.teamId,
      provider: input.provider,
      provider_team_id: input.providerTeamId,
      provider_team_name: input.providerTeamName,
      provider_logo_url: input.providerLogoUrl,
      formation: input.formation,
      players: input.players,
      source: input.source,
      fetched_at: new Date().toISOString()
    },
    { onConflict: "team_id" }
  );
}

async function savePlayers(
  supabase: SupabaseClient | null,
  teamId: string,
  players: SquadPlayer[],
  provider = "api-football",
  source = "api-football-squad"
) {
  if (!supabase || players.length === 0) {
    return;
  }

  await supabase.from("players").upsert(
    players.map((player) => ({
      id: player.id.startsWith(`${teamId}-`) ? player.id : playerCatalogId(teamId, player.id),
      team_id: teamId,
      name: player.name,
      age: player.age,
      shirt_number: player.number,
      position: player.position,
      photo_url: player.photoUrl,
      provider,
      provider_player_id: player.id,
      source,
      raw: player,
      fetched_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
}

function catalogToSquadPlayers(players: PlayerCatalogItem[]): SquadPlayer[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    age: player.age ?? null,
    number: player.shirtNumber ?? null,
    position: player.position,
    photoUrl: player.photoUrl ?? null
  }));
}

function preferredTeamResult(payload: ApiFootballTeamSearch, teamName: string) {
  const normalized = teamName.toLowerCase();
  return (
    payload.response?.find((item) => item.team?.national && item.team.name?.toLowerCase() === normalized) ??
    payload.response?.find((item) => item.team?.national) ??
    payload.response?.[0]
  );
}

export async function GET(_request: NextRequest, context: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await context.params;
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json({ ok: false, error: "Team not found." }, { status: 404 });
  }

  const supabase = getServiceSupabase();
  const formation = formationForTeam(team);
  const preferEspn = ESPN_PREFERRED_TEAM_IDS.has(team.id);
  const savedSquad = await readSavedSquad(supabase, team.id);
  if (savedSquad && (!preferEspn || savedSquad.provider === "espn")) {
    return NextResponse.json(
      {
        ok: true,
        provider: savedSquad.provider,
        source: "supabase-team-squads",
        cached: true,
        formation: savedSquad.formation ?? formation,
        team: {
          id: savedSquad.provider_team_id,
          name: savedSquad.provider_team_name ?? team.name,
          logoUrl: savedSquad.provider_logo_url
        },
        players: savedSquad.players
      },
      { headers: CACHE_HEADERS }
    );
  }

  const savedPlayers = await readSavedPlayers(supabase, team.id);
  if (isCompleteSquad(savedPlayers) && !preferEspn) {
    return NextResponse.json(
      {
        ok: true,
        provider: "supabase",
        source: "supabase-players",
        cached: true,
        formation,
        team: {
          id: null,
          name: team.name,
          logoUrl: null
        },
        players: savedPlayers
      },
      { headers: CACHE_HEADERS }
    );
  }

  const espnRoster = await fetchEspnRoster(team);
  if (espnRoster && espnRoster.players.length >= COMPLETE_SQUAD_MINIMUM) {
    const players = catalogToSquadPlayers(espnRoster.players);
    await saveSquad(supabase, {
      teamId: team.id,
      provider: "espn",
      source: "espn-roster",
      providerTeamId: Number(espnRoster.providerTeamId),
      providerTeamName: espnRoster.providerTeamName,
      providerLogoUrl: espnRoster.providerLogoUrl,
      formation,
      players
    });
    await savePlayers(supabase, team.id, players, "espn", "espn-roster");

    return NextResponse.json(
      {
        ok: true,
        provider: "espn",
        source: "espn-roster",
        cached: false,
        formation,
        team: {
          id: Number(espnRoster.providerTeamId),
          name: espnRoster.providerTeamName,
          logoUrl: espnRoster.providerLogoUrl
        },
        players
      },
      { headers: CACHE_HEADERS }
    );
  }

  try {
    const searchName = TEAM_SEARCH_NAMES[team.id] ?? team.name;
    const search = await fetchApiFootball<ApiFootballTeamSearch>(`/teams?search=${encodeURIComponent(searchName)}`);
    const result = preferredTeamResult(search, searchName);
    const providerTeamId = result?.team?.id;

    if (!providerTeamId) {
      return NextResponse.json(
        { ok: true, provider: "api-football", players: [], source: "none", formation },
        { headers: PARTIAL_HEADERS }
      );
    }

    const squad = await fetchApiFootball<ApiFootballSquad>(`/players/squads?team=${providerTeamId}`);
    const squadPlayers = squad.response?.[0]?.players ?? [];
    const players: SquadPlayer[] =
      squadPlayers
        .map((player) => ({
          id: player.id ? String(player.id) : (player.name ?? "Player"),
          name: player.name ?? "Player",
          age: player.age ?? null,
          number: player.number ?? null,
          position: player.position ?? "Player",
          photoUrl: player.photo ?? null
        }))
        .filter((player) => player.name !== "Player" || player.id !== "Player") ?? [];

    await saveSquad(supabase, {
      teamId: team.id,
      provider: "api-football",
      source: "api-football-squad",
      providerTeamId,
      providerTeamName: result?.team?.name ?? team.name,
      providerLogoUrl: result?.team?.logo ?? null,
      formation,
      players
    });
    await savePlayers(supabase, team.id, players);

    return NextResponse.json(
      {
        ok: true,
        provider: "api-football",
        source: "api-football-squad",
        cached: false,
        formation,
        team: {
          id: providerTeamId,
          name: result?.team?.name ?? team.name,
          logoUrl: result?.team?.logo ?? null
        },
        players
      },
      { headers: isCompleteSquad(players) ? CACHE_HEADERS : PARTIAL_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not load squad."
      },
      { status: 200 }
    );
  }
}
