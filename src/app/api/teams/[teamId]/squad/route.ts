import { NextResponse, type NextRequest } from "next/server";
import { getTeam } from "@/lib/tournament-data";

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
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) {
    throw new Error(`API-Football returned ${response.status}.`);
  }

  return response.json() as Promise<T>;
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

  try {
    const searchName = TEAM_SEARCH_NAMES[team.id] ?? team.name;
    const search = await fetchApiFootball<ApiFootballTeamSearch>(`/teams?search=${encodeURIComponent(searchName)}`);
    const result = preferredTeamResult(search, searchName);
    const providerTeamId = result?.team?.id;

    if (!providerTeamId) {
      return NextResponse.json({ ok: true, provider: "api-football", players: [], source: "none" });
    }

    const squad = await fetchApiFootball<ApiFootballSquad>(`/players/squads?team=${providerTeamId}`);
    const players =
      squad.response?.[0]?.players
        ?.filter((player) => player.name)
        .map((player) => ({
          id: player.id ? String(player.id) : player.name,
          name: player.name ?? "Player",
          age: player.age ?? null,
          number: player.number ?? null,
          position: player.position ?? "Player",
          photoUrl: player.photo ?? null
        })) ?? [];

    return NextResponse.json({
      ok: true,
      provider: "api-football",
      source: "api-football-squad",
      team: {
        id: providerTeamId,
        name: result?.team?.name ?? team.name,
        logoUrl: result?.team?.logo ?? null
      },
      players
    });
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
