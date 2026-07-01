import { getAllPlayerProfiles } from "./profile-data";
import { TEAMS, getTeam } from "./tournament-data";
import type { PlayerCatalogItem, Team } from "./types";

export const COMPLETE_SQUAD_MINIMUM = 15;
export const ESPN_PREFERRED_TEAM_IDS = new Set(["czechia", "spain"]);

export const ESPN_TEAM_IDS: Record<string, string> = {
  mexico: "203",
  "south-africa": "467",
  "korea-republic": "451",
  czechia: "450",
  canada: "206",
  switzerland: "475",
  qatar: "4398",
  "bosnia-herzegovina": "452",
  brazil: "205",
  morocco: "2869",
  haiti: "2654",
  scotland: "580",
  usa: "660",
  paraguay: "210",
  australia: "628",
  turkiye: "465",
  germany: "481",
  curacao: "11678",
  "cote-divoire": "4789",
  ecuador: "209",
  netherlands: "449",
  japan: "627",
  tunisia: "659",
  sweden: "466",
  belgium: "459",
  egypt: "2620",
  "ir-iran": "469",
  "new-zealand": "2666",
  spain: "164",
  "cabo-verde": "2597",
  "saudi-arabia": "655",
  uruguay: "212",
  france: "478",
  senegal: "654",
  norway: "464",
  iraq: "4375",
  argentina: "202",
  algeria: "624",
  austria: "474",
  jordan: "2917",
  portugal: "482",
  uzbekistan: "2570",
  colombia: "208",
  "congo-dr": "2850",
  england: "448",
  croatia: "477",
  ghana: "4469",
  panama: "2659"
};

type EspnRosterAthlete = {
  id?: string | number;
  displayName?: string;
  fullName?: string;
  shortName?: string;
  age?: number;
  gender?: string;
  jersey?: string | number | null;
  headshot?: {
    href?: string;
  } | null;
  position?: {
    displayName?: string;
    name?: string;
    abbreviation?: string;
  };
};

type EspnRosterPayload = {
  athletes?: EspnRosterAthlete[];
  team?: {
    id?: string | number;
    displayName?: string;
    name?: string;
    logo?: string;
    logos?: Array<{ href?: string }>;
  };
};

export type EspnRosterResult = {
  providerTeamId: string;
  providerTeamName: string;
  providerLogoUrl: string | null;
  players: PlayerCatalogItem[];
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function playerCatalogId(teamId: string, value: string | number) {
  return `${teamId}-${slugify(String(value)) || "player"}`;
}

const CATALOG_PHOTO_OVERRIDES: Record<string, string> = {
  "brazil-159047":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Marquinhos_Brazil_V_Morocco_13_June_2026-153_%28cropped%29.jpg/960px-Marquinhos_Brazil_V_Morocco_13_June_2026-153_%28cropped%29.jpg",
  "brazil-231050": "https://b.fssta.com/uploads/application/soccer/headshots/42944.png",
  "brazil-raphinha": "https://b.fssta.com/uploads/application/soccer/headshots/42944.png",
  "portugal-874": "https://b.fssta.com/uploads/application/soccer/headshots/885.png",
  "portugal-cristiano-ronaldo": "https://b.fssta.com/uploads/application/soccer/headshots/885.png",
  "spain-227765": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Dani_Olmo_2022.jpg"
};

function playerCatalogIdSuffix(row: Pick<PlayerCatalogItem, "id" | "teamId">) {
  return row.id.startsWith(`${row.teamId}-`) ? row.id.slice(row.teamId.length + 1) : row.id;
}

function providerPhotoUrl(row: Pick<PlayerCatalogItem, "id" | "teamId" | "photoUrl">) {
  const override = CATALOG_PHOTO_OVERRIDES[row.id];
  if (override) {
    return override;
  }

  if (row.photoUrl) {
    return row.photoUrl;
  }

  const suffix = playerCatalogIdSuffix(row);
  return /^\d+$/.test(suffix) ? `https://media.api-sports.io/football/players/${suffix}.png` : null;
}

function isGeneratedProviderPhoto(value: string | null | undefined) {
  return Boolean(value?.startsWith("https://media.api-sports.io/football/players/"));
}

function mergePhotoUrl(existing: string | null | undefined, incoming: string | null | undefined) {
  if (!existing) {
    return incoming ?? null;
  }
  if (incoming && Object.values(CATALOG_PHOTO_OVERRIDES).includes(incoming)) {
    return incoming;
  }
  if (incoming && isGeneratedProviderPhoto(existing) && !isGeneratedProviderPhoto(incoming)) {
    return incoming;
  }
  return existing;
}

function comparableName(value: string) {
  return slugify(value);
}

function parseShirtNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePosition(position: string | undefined) {
  const value = position?.trim();
  if (!value) {
    return "Player";
  }
  if (value === "G") {
    return "Goalkeeper";
  }
  if (value === "D") {
    return "Defender";
  }
  if (value === "M") {
    return "Midfielder";
  }
  if (value === "F") {
    return "Forward";
  }
  return value;
}

export function parseEspnRoster(team: Team, payload: EspnRosterPayload): EspnRosterResult {
  const providerTeamId = String(payload.team?.id ?? ESPN_TEAM_IDS[team.id] ?? team.id);
  const providerTeamName = payload.team?.displayName ?? payload.team?.name ?? team.name;
  const providerLogoUrl = payload.team?.logo ?? payload.team?.logos?.find((logo) => logo.href)?.href ?? null;

  const players =
    payload.athletes
      ?.filter((athlete) => athlete.gender !== "FEMALE")
      .map((athlete) => {
        const name = athlete.displayName ?? athlete.fullName ?? athlete.shortName ?? "";
        const providerId = athlete.id ?? name;
        return {
          id: playerCatalogId(team.id, providerId),
          teamId: team.id,
          name,
          age: athlete.age ?? null,
          shirtNumber: parseShirtNumber(athlete.jersey),
          position: normalizePosition(
            athlete.position?.displayName ?? athlete.position?.name ?? athlete.position?.abbreviation
          ),
          photoUrl: athlete.headshot?.href ?? null
        };
      })
      .filter((player) => player.name.trim().length > 0) ?? [];

  return {
    providerTeamId,
    providerTeamName,
    providerLogoUrl,
    players
  };
}

export async function fetchEspnRoster(team: Team): Promise<EspnRosterResult | null> {
  const espnTeamId = ESPN_TEAM_IDS[team.id];
  if (!espnTeamId) {
    return null;
  }

  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${espnTeamId}/roster`,
    {
      next: { revalidate: 60 * 60 * 24 }
    }
  );

  if (!response.ok) {
    return null;
  }

  return parseEspnRoster(team, (await response.json()) as EspnRosterPayload);
}

function curatedCatalog() {
  return getAllPlayerProfiles().map(({ player, team }) => ({
    id: player.id,
    teamId: team.id,
    name: player.name,
    age: null,
    shirtNumber: player.shirtNumber ?? null,
    position: player.position,
    photoUrl: player.photoUrl ?? null
  }));
}

function fallbackPosition(index: number) {
  if (index === 0) {
    return "Goalkeeper";
  }
  if (index < 6) {
    return "Defender";
  }
  if (index < 11) {
    return "Midfielder";
  }
  return "Forward";
}

function projectedFallback(team: Team, existingCount: number) {
  return Array.from({ length: Math.max(0, COMPLETE_SQUAD_MINIMUM - existingCount) }, (_item, index) => {
    const playerNumber = existingCount + index + 1;
    return {
      id: playerCatalogId(team.id, `projected-${playerNumber}`),
      teamId: team.id,
      name: `${team.name} Squad Player ${playerNumber}`,
      age: null,
      shirtNumber: playerNumber,
      position: fallbackPosition(playerNumber - 1),
      photoUrl: null
    };
  });
}

export function mergePlayerCatalog(
  databaseRows: PlayerCatalogItem[] = [],
  espnRows: PlayerCatalogItem[] = []
): PlayerCatalogItem[] {
  const curatedRows = curatedCatalog();
  const dbByTeam = groupByTeam(databaseRows);
  const espnByTeam = groupByTeam(espnRows);
  const curatedByTeam = groupByTeam(curatedRows);
  const result: PlayerCatalogItem[] = [];

  for (const team of TEAMS) {
    const byName = new Map<string, PlayerCatalogItem>();
    const byId = new Set<string>();
    const espnTeamRows = espnByTeam.get(team.id) ?? [];
    const databaseTeamRows =
      ESPN_PREFERRED_TEAM_IDS.has(team.id) && espnTeamRows.length >= COMPLETE_SQUAD_MINIMUM ? [] : dbByTeam.get(team.id) ?? [];
    const curatedTeamRows = curatedByTeam.get(team.id) ?? [];
    const orderedRows =
      espnTeamRows.length >= COMPLETE_SQUAD_MINIMUM
        ? [...espnTeamRows, ...curatedTeamRows]
        : [...databaseTeamRows, ...espnTeamRows, ...curatedTeamRows];

    for (const row of orderedRows) {
      if (!getTeam(row.teamId) || !row.name.trim()) {
        continue;
      }

      const nameKey = comparableName(row.name);
      const rowWithPhoto = { ...row, photoUrl: providerPhotoUrl(row) };
      const existingByName = byName.get(nameKey);
      if (existingByName) {
        byName.set(nameKey, {
          ...existingByName,
          age: existingByName.age ?? rowWithPhoto.age ?? null,
          shirtNumber: existingByName.shirtNumber ?? rowWithPhoto.shirtNumber ?? null,
          position: existingByName.position || rowWithPhoto.position,
          photoUrl: mergePhotoUrl(existingByName.photoUrl, rowWithPhoto.photoUrl)
        });
        continue;
      }

      if (byId.has(rowWithPhoto.id)) {
        continue;
      }

      byId.add(rowWithPhoto.id);
      byName.set(nameKey, rowWithPhoto);
    }

    const teamRows = [...byName.values()];
    teamRows.push(...projectedFallback(team, teamRows.length));
    result.push(...teamRows.slice(0, Math.max(teamRows.length, COMPLETE_SQUAD_MINIMUM)));
  }

  return result.sort((a, b) => {
    const teamA = getTeam(a.teamId);
    const teamB = getTeam(b.teamId);
    return (
      (teamA?.group ?? "").localeCompare(teamB?.group ?? "") ||
      (teamA?.name ?? "").localeCompare(teamB?.name ?? "") ||
      a.position.localeCompare(b.position) ||
      (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) ||
      a.name.localeCompare(b.name)
    );
  });
}

function groupByTeam(rows: PlayerCatalogItem[]) {
  const map = new Map<string, PlayerCatalogItem[]>();
  for (const row of rows) {
    map.set(row.teamId, [...(map.get(row.teamId) ?? []), row]);
  }
  return map;
}

export function teamsBelowMinimum(rows: PlayerCatalogItem[]) {
  const counts = groupByTeam(rows);
  return TEAMS.filter((team) => (counts.get(team.id)?.length ?? 0) < COMPLETE_SQUAD_MINIMUM);
}
