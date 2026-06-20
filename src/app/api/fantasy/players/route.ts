import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  COMPLETE_SQUAD_MINIMUM,
  fetchEspnRoster,
  mergePlayerCatalog,
  teamsBelowMinimum
} from "@/lib/player-catalog";
import { TEAMS } from "@/lib/tournament-data";
import type { PlayerCatalogItem } from "@/lib/types";

type PlayerRow = {
  id: string;
  team_id: string;
  name: string;
  age: number | null;
  shirt_number: number | null;
  position: string;
  photo_url: string | null;
};

const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };

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

function rowToCatalog(row: PlayerRow): PlayerCatalogItem {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    age: row.age,
    shirtNumber: row.shirt_number,
    position: row.position,
    photoUrl: row.photo_url
  };
}

async function saveEspnPlayers(supabase: ReturnType<typeof getServiceSupabase>, rows: PlayerCatalogItem[]) {
  if (!supabase || rows.length < COMPLETE_SQUAD_MINIMUM) {
    return;
  }

  await supabase.from("players").upsert(
    rows.map((player) => ({
      id: player.id,
      team_id: player.teamId,
      name: player.name,
      age: player.age ?? null,
      shirt_number: player.shirtNumber ?? null,
      position: player.position,
      photo_url: player.photoUrl ?? null,
      provider: "espn",
      provider_player_id: player.id.replace(`${player.teamId}-`, ""),
      source: "espn-roster",
      raw: player,
      fetched_at: new Date().toISOString()
    })),
    { onConflict: "id" }
  );
}

async function saveTeamSquad(
  supabase: ReturnType<typeof getServiceSupabase>,
  result: Awaited<ReturnType<typeof fetchEspnRoster>>
) {
  if (!supabase || !result || result.players.length < COMPLETE_SQUAD_MINIMUM) {
    return;
  }

  const teamId = result.players[0]?.teamId;
  if (!teamId) {
    return;
  }

  await supabase.from("team_squads").upsert(
    {
      team_id: teamId,
      provider: "espn",
      provider_team_id: Number(result.providerTeamId),
      provider_team_name: result.providerTeamName,
      provider_logo_url: result.providerLogoUrl,
      players: result.players.map((player) => ({
        id: player.id,
        name: player.name,
        age: player.age ?? null,
        number: player.shirtNumber ?? null,
        position: player.position,
        photoUrl: player.photoUrl ?? null
      })),
      source: "espn-roster",
      fetched_at: new Date().toISOString()
    },
    { onConflict: "team_id" }
  );
}

export async function GET() {
  const supabase = getServiceSupabase();
  let databaseRows: PlayerCatalogItem[] = [];
  let databaseWarning: string | null = null;

  if (supabase) {
    const { data, error } = await supabase
      .from("players")
      .select("id, team_id, name, age, shirt_number, position, photo_url");
    if (error) {
      databaseWarning = error.message;
    } else {
      databaseRows = ((data || []) as PlayerRow[]).map(rowToCatalog);
    }
  }

  const missingTeams = new Set(teamsBelowMinimum(databaseRows).map((team) => team.id));
  missingTeams.add("czechia");

  const teamsToFetch = TEAMS.filter((team) => missingTeams.has(team.id));
  const rosterResults = await Promise.allSettled(teamsToFetch.map((team) => fetchEspnRoster(team)));
  const espnRows: PlayerCatalogItem[] = [];
  const fetchedTeams: string[] = [];

  for (const result of rosterResults) {
    if (result.status !== "fulfilled" || !result.value || result.value.players.length === 0) {
      continue;
    }

    espnRows.push(...result.value.players);
    fetchedTeams.push(result.value.players[0].teamId);
    await saveEspnPlayers(supabase, result.value.players);
    await saveTeamSquad(supabase, result.value);
  }

  const players = mergePlayerCatalog(databaseRows, espnRows);
  return NextResponse.json(
    {
      ok: true,
      players,
      source: "espn-plus-supabase",
      fetchedTeams,
      warning: databaseWarning
    },
    { headers: CACHE_HEADERS }
  );
}
