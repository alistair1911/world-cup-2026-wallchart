import { getAllPlayerProfiles, getPlayerProfile } from "./profile-data";
import { INITIAL_MATCHES, TEAMS, getTeam } from "./tournament-data";
import type {
  FantasyPlayerMatchScore,
  FantasyPosition,
  FantasyRosterSlot,
  Match,
  MatchPhase,
  PlayerCatalogItem,
  PlayerMatchStat,
  Team,
  UserKey
} from "./types";

export type FantasyRoundId = "group" | "round32" | "round16" | "quarter" | "semi" | "final";

export type FantasyRoundDefinition = {
  id: FantasyRoundId;
  name: string;
  shortName: string;
  phases: MatchPhase[];
  squadSize: number;
  starterSize: number;
};

export type FantasyRoundStatus = "upcoming" | "open" | "locked" | "complete";

export type FantasyRoundState = FantasyRoundDefinition & {
  startsAt: string;
  locksAt: string;
  endsAt: string;
  status: FantasyRoundStatus;
  selectionEnabled: boolean;
  matchCount: number;
  finalCount: number;
};

export type FantasyRoundResult = FantasyRoundState & {
  leaderboard: FantasyLeaderboardRow[];
  winner?: FantasyLeaderboardRow;
  tied: boolean;
};

export type FantasyOverallRow = {
  userKey: UserKey;
  displayName: string;
  roundWins: number;
  currentRoundPoints: number;
};

export const FANTASY_ROUND_ID: FantasyRoundId = "group";
export const FANTASY_SQUAD_SIZE = 15;
export const FANTASY_STARTERS = 11;
export const FANTASY_ROUNDS: FantasyRoundDefinition[] = [
  { id: "group", name: "Group Stage", shortName: "Groups", phases: ["group"], squadSize: FANTASY_SQUAD_SIZE, starterSize: FANTASY_STARTERS },
  { id: "round32", name: "Round of 32", shortName: "R32", phases: ["round32"], squadSize: FANTASY_STARTERS, starterSize: FANTASY_STARTERS },
  { id: "round16", name: "Round of 16", shortName: "R16", phases: ["round16"], squadSize: FANTASY_STARTERS, starterSize: FANTASY_STARTERS },
  { id: "quarter", name: "Quarter-Finals", shortName: "QF", phases: ["quarter"], squadSize: FANTASY_STARTERS, starterSize: FANTASY_STARTERS },
  { id: "semi", name: "Semi-Finals", shortName: "SF", phases: ["semi"], squadSize: FANTASY_STARTERS, starterSize: FANTASY_STARTERS },
  { id: "final", name: "Final", shortName: "Final", phases: ["final"], squadSize: FANTASY_STARTERS, starterSize: FANTASY_STARTERS }
];
export const FANTASY_SCORING_RULES = [
  { label: "Goal", detail: "GK/DEF +6, MID +5, FWD +4" },
  { label: "Assist", detail: "+3" },
  { label: "Clean sheet", detail: "GK/DEF +4, MID +1" },
  { label: "Team result", detail: "Win +2, draw +1" },
  { label: "Defensive result", detail: "GK/DEF +1 if conceding 1, -1 per 2 conceded" },
  { label: "Yellow / red", detail: "-1 / -3" },
  { label: "Own goal", detail: "-2" },
  { label: "Penalty", detail: "Save +5, miss -2" }
] as const;

export type FantasyPlayerOption = {
  id: string;
  aliasIds?: string[];
  name: string;
  team: Team;
  position: string;
  fantasyPosition: FantasyPosition;
  photoUrl?: string;
};

export type FantasyLeaderboardRow = {
  userKey: UserKey;
  displayName: string;
  points: number;
  captainPoints: number;
  rosterSize: number;
  captain?: FantasyPlayerOption;
  bestPlayer?: FantasyPlayerOption & { points: number };
};

type FantasyPlayerLookup = {
  options: FantasyPlayerOption[];
  byId: Map<string, FantasyPlayerOption>;
  byName: Map<string, FantasyPlayerOption>;
  idsByOptionId: Map<string, string[]>;
};

type FantasyPlayerTotal = {
  points: number;
  goals: number;
  assists: number;
  cleanSheets: number;
};

const familyDisplayName: Record<UserKey, string> = {
  tata: "Tata",
  lucas: "Lucas"
};
const EMPTY_PLAYER_CATALOG: PlayerCatalogItem[] = [];
const EMPTY_PLAYER_TOTALS: FantasyPlayerTotal = { points: 0, goals: 0, assists: 0, cleanSheets: 0 };
const lookupCache = new WeakMap<PlayerCatalogItem[], FantasyPlayerLookup>();
let emptyLookupCache: FantasyPlayerLookup | null = null;
const totalsCache = new WeakMap<FantasyPlayerMatchScore[], WeakMap<PlayerCatalogItem[], Map<string, FantasyPlayerTotal>>>();
const CURATED_PROVIDER_ALIASES: Record<string, string[]> = {
  "argentina-lionel-messi": ["argentina-154", "154", "argentina-45843", "45843"],
  "canada-jonathan-david": ["canada-8489", "8489"],
  "england-harry-kane": ["england-184", "184", "england-39836", "39836"],
  "spain-lamine-yamal": ["spain-362150", "362150"],
  "usa-christian-pulisic": ["usa-225607", "225607"]
};

const FANTASY_ROUND_IDS = new Set(FANTASY_ROUNDS.map((round) => round.id));

function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function fallbackRoundMatches(round: FantasyRoundDefinition) {
  return INITIAL_MATCHES.filter((match) => round.phases.includes(match.phase));
}

export function normalizeFantasyRoundId(roundId: string | null | undefined): FantasyRoundId {
  if (roundId === "global" || !roundId) {
    return FANTASY_ROUND_ID;
  }
  return FANTASY_ROUND_IDS.has(roundId as FantasyRoundId) ? (roundId as FantasyRoundId) : FANTASY_ROUND_ID;
}

export function fantasyRoundDefinition(roundId: string | null | undefined) {
  const normalized = normalizeFantasyRoundId(roundId);
  return FANTASY_ROUNDS.find((round) => round.id === normalized) ?? FANTASY_ROUNDS[0];
}

export function fantasyRoundRosterSize(roundId: string | null | undefined) {
  return fantasyRoundDefinition(roundId).squadSize;
}

export function fantasyRoundStarterSize(roundId: string | null | undefined) {
  return fantasyRoundDefinition(roundId).starterSize;
}

export function isFantasyKnockoutRound(roundId: string | null | undefined) {
  return normalizeFantasyRoundId(roundId) !== FANTASY_ROUND_ID;
}

export function matchesForFantasyRound(roundId: string, matches: Match[]) {
  const round = fantasyRoundDefinition(roundId);
  return matches.filter((match) => round.phases.includes(match.phase));
}

function roundSchedule(round: FantasyRoundDefinition, matches: Match[]) {
  const roundMatches = matches.filter((match) => round.phases.includes(match.phase));
  const fallbackMatches = roundMatches.length > 0 ? roundMatches : fallbackRoundMatches(round);
  const sorted = [...fallbackMatches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const startsAt = sorted[0]?.kickoff ?? new Date(0).toISOString();
  const locksAt = startsAt;
  const endsAt = sorted.at(-1)?.kickoff ? addHours(sorted.at(-1)!.kickoff, 3) : startsAt;
  return { startsAt, locksAt, endsAt, roundMatches };
}

export function fantasyRoundStates(matches: Match[], now = new Date()): FantasyRoundState[] {
  return FANTASY_ROUNDS.map((round) => {
    const { startsAt, locksAt, endsAt, roundMatches } = roundSchedule(round, matches);
    const finalCount = roundMatches.filter((match) => match.status === "final").length;
    const complete = roundMatches.length > 0 && finalCount === roundMatches.length;
    const locked = now.getTime() >= new Date(locksAt).getTime();
    const selectionEnabled = !complete && !locked;
    const status: FantasyRoundStatus = complete ? "complete" : selectionEnabled ? "open" : locked ? "locked" : "upcoming";
    return {
      ...round,
      startsAt,
      locksAt,
      endsAt,
      status,
      selectionEnabled,
      matchCount: roundMatches.length,
      finalCount
    };
  });
}

export function activeFantasyRound(matches: Match[], now = new Date()) {
  const states = fantasyRoundStates(matches, now);
  return states.find((round) => round.status === "open") ?? states.find((round) => round.status !== "complete") ?? states.at(-1)!;
}

export function rostersForFantasyRound(roundId: string, rosters: FantasyRosterSlot[]) {
  const normalizedRoundId = normalizeFantasyRoundId(roundId);
  const matching = rosters.filter((slot) => normalizeFantasyRoundId(slot.roundId) === normalizedRoundId);
  const hasCanonicalRoster = new Set(
    matching.filter((slot) => slot.roundId === normalizedRoundId).map((slot) => slot.userKey)
  );

  return matching
    .filter((slot) => slot.roundId === normalizedRoundId || !hasCanonicalRoster.has(slot.userKey))
    .map((slot) => ({ ...slot, roundId: normalizedRoundId }));
}

export function scoresForFantasyRound(roundId: string, scores: FantasyPlayerMatchScore[], matches: Match[]) {
  const matchIds = new Set(matchesForFantasyRound(roundId, matches).map((match) => match.id));
  return scores.filter((score) => matchIds.has(score.matchId));
}

function teamIdsForMatch(match: Match) {
  return [match.homeTeamId, match.awayTeamId].filter((teamId): teamId is string => Boolean(teamId));
}

function knockoutWinnerTeamId(match: Match) {
  if (match.status !== "final") {
    return null;
  }
  if (match.penaltyWinnerId) {
    return match.penaltyWinnerId;
  }
  if (match.homeScore === null || match.awayScore === null || !match.homeTeamId || !match.awayTeamId) {
    return null;
  }
  if (match.homeScore > match.awayScore) {
    return match.homeTeamId;
  }
  if (match.awayScore > match.homeScore) {
    return match.awayTeamId;
  }
  return null;
}

function aliveTeamsFromMatches(matches: Match[]) {
  const alive = new Set<string>();
  for (const match of matches) {
    const winner = knockoutWinnerTeamId(match);
    if (winner) {
      alive.add(winner);
      continue;
    }
    for (const teamId of teamIdsForMatch(match)) {
      alive.add(teamId);
    }
  }
  return alive;
}

export function eligibleTeamIdsForFantasyRound(matches: Match[], round: Pick<FantasyRoundDefinition, "id" | "phases"> & { matchCount?: number }) {
  const roundMatches = matches.filter((match) => round.phases.includes(match.phase));
  const assignedTeams = new Set(roundMatches.flatMap(teamIdsForMatch));
  const expectedTeams = Math.max(2, (round.matchCount ?? roundMatches.length) * 2);

  if (assignedTeams.size >= expectedTeams) {
    return assignedTeams;
  }

  const roundIndex = FANTASY_ROUNDS.findIndex((definition) => definition.id === round.id);
  const previousRound = roundIndex > 0 ? FANTASY_ROUNDS[roundIndex - 1] : null;
  const previousMatches = previousRound ? matches.filter((match) => previousRound.phases.includes(match.phase)) : [];
  const previousAliveTeams = aliveTeamsFromMatches(previousMatches);
  if (previousAliveTeams.size > 0) {
    for (const teamId of assignedTeams) {
      previousAliveTeams.add(teamId);
    }
    return previousAliveTeams;
  }

  if (assignedTeams.size > 0) {
    return assignedTeams;
  }

  return new Set(matches.filter((match) => match.status !== "final").flatMap(teamIdsForMatch));
}

export function normalizeFantasyPosition(position: string): FantasyPosition {
  const compact = position.toUpperCase();
  const value = position.toLowerCase();
  if (value.includes("goal") || compact === "GK") {
    return "GK";
  }
  if (value.includes("def") || ["CB", "DF", "LB", "RB", "LWB", "RWB"].includes(compact)) {
    return "DEF";
  }
  if (value.includes("mid") || ["DM", "CM", "AM", "MF"].includes(compact)) {
    return "MID";
  }
  return "FWD";
}

const FORMATION_POSITION_CAPS: Record<string, Record<FantasyPosition, number>> = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-2-3-1": { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  "3-4-3": { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "5-3-2": { GK: 1, DEF: 5, MID: 3, FWD: 2 }
};

const LUCAS_FORMATION_BYPASS_NAMES = new Set(["pau-cubarsi", "mikel-merino", "unai-simon", "marc-cucurella"]);

export function shouldEnforceFantasyFormation(roundId: string | null | undefined) {
  void roundId;
  return false;
}

export function fantasyFormationPositionCaps(formation: string | null | undefined) {
  return FORMATION_POSITION_CAPS[formation || ""] ?? FORMATION_POSITION_CAPS["4-3-3"];
}

export function isFantasyFormationBypassPlayer(
  userKey: UserKey | null | undefined,
  playerId: string,
  playerCatalog: PlayerCatalogItem[]
) {
  if (userKey !== "lucas") {
    return false;
  }

  const option = resolveFantasyPlayerOption({ playerId }, playerCatalog);
  const catalogPlayer = playerCatalog.find((player) => player.id === playerId);
  const teamId = option?.team.id ?? catalogPlayer?.teamId ?? (playerId.startsWith("spain-") ? "spain" : null);
  if (teamId !== "spain") {
    return false;
  }

  const idSuffix = playerId.startsWith("spain-") ? playerId.slice("spain-".length) : playerId;
  return [option?.name, catalogPlayer?.name, idSuffix]
    .filter((value): value is string => Boolean(value))
    .some((value) => LUCAS_FORMATION_BYPASS_NAMES.has(comparablePlayerName(value)));
}

export function fantasyFormationLimitMessage(
  playerId: string,
  slots: FantasyRosterSlot[],
  formation: string | null | undefined,
  playerCatalog: PlayerCatalogItem[],
  roundId: string | null | undefined,
  userKey?: UserKey | null
) {
  void playerId;
  void slots;
  void formation;
  void playerCatalog;
  void roundId;
  void userKey;
  return null;
}

export function trimFantasyRosterToFormation(
  slots: FantasyRosterSlot[],
  formation: string | null | undefined,
  playerCatalog: PlayerCatalogItem[],
  roundId: string | null | undefined
) {
  void formation;
  void playerCatalog;
  return normalizeFantasyRosterSlots(slots, slots[0]?.userKey, roundId);
}

function sortFantasyOptions(options: FantasyPlayerOption[]) {
  return options.sort(
    (a, b) =>
      a.team.group.localeCompare(b.team.group) ||
      a.team.name.localeCompare(b.team.name) ||
      a.fantasyPosition.localeCompare(b.fantasyPosition) ||
      a.name.localeCompare(b.name)
  );
}

function comparablePlayerName(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function comparableIdentityName(value: string) {
  const withoutMiddleNames = value.replace(/\b(andres|edward|james|charles|philip|lewis|maria|de|da|dos|del|van|von|bin|al)\b/gi, " ");
  const commaParts = withoutMiddleNames.split(",").map((part) => part.trim()).filter(Boolean);
  return commaParts.length === 2 ? `${commaParts[1]} ${commaParts[0]}` : withoutMiddleNames;
}

function playerNameParts(value: string) {
  return comparablePlayerName(comparableIdentityName(value)).split("-").filter(Boolean);
}

function playerFullNameKeys(value: string) {
  const full = comparablePlayerName(value);
  const parts = playerNameParts(value);
  const last = parts.at(-1);
  const initialLast = parts.length > 1 && last ? `${parts[0][0]}-${last}` : null;

  return Array.from(new Set([full, initialLast].filter((key): key is string => Boolean(key))));
}

function playerLooseNameKeys(value: string) {
  const parts = playerNameParts(value);
  const last = parts.at(-1);
  return last ? [last] : [];
}

function playerNameLookupKeys(value: string) {
  return Array.from(new Set([...playerFullNameKeys(value), ...playerLooseNameKeys(value)]));
}

function playerIdSuffix(teamId: string, playerId: string) {
  return playerId.startsWith(`${teamId}-`) ? playerId.slice(teamId.length + 1) : "";
}

function providerIdLookupKeys(value: string) {
  const keys = new Set<string>();
  const normalized = comparablePlayerName(value);
  const rawSegments = value.split(/[/:|\\]+/).map((part) => part.trim()).filter(Boolean);
  const normalizedSegments = normalized.split("-").filter(Boolean);

  for (const candidate of [value, normalized, rawSegments.at(-1) ?? "", normalizedSegments.at(-1) ?? ""]) {
    const key = comparablePlayerName(candidate);
    if (/^\d+$/.test(key)) {
      keys.add(key);
    }
  }

  return [...keys];
}

function optionProviderIdLookupKeys(option: FantasyPlayerOption) {
  const keys = new Set<string>();
  for (const id of [option.id, ...(option.aliasIds ?? [])]) {
    const suffix = playerIdSuffix(option.team.id, id);
    for (const key of providerIdLookupKeys(suffix || id)) {
      keys.add(key);
    }
  }
  return [...keys];
}

function directPlayerIdLookupKeys(playerId: string) {
  const keys = new Set([playerId]);
  const normalized = comparablePlayerName(playerId);
  if (normalized) {
    keys.add(normalized);
  }
  for (const key of providerIdLookupKeys(playerId)) {
    keys.add(key);
  }
  return [...keys];
}

function teamNameKey(teamId: string, nameKey: string) {
  return `${teamId}:${nameKey}`;
}

function normalizeTeamId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const direct = getTeam(value);
  if (direct) {
    return direct.id;
  }

  const normalized = comparablePlayerName(value);
  return (
    TEAMS.find(
      (team) =>
        comparablePlayerName(team.id) === normalized ||
        comparablePlayerName(team.name) === normalized ||
        comparablePlayerName(team.code) === normalized
    )?.id ?? null
  );
}

function playerIdentityKey(teamId: string, name: string) {
  const parts = playerNameParts(name);
  const first = parts[0];
  const last = parts.at(-1);
  return first && last ? `${teamId}:${first[0]}-${last}` : `${teamId}:${comparablePlayerName(name)}`;
}

export function fantasyPlayerOptions(playerCatalog: PlayerCatalogItem[] = []): FantasyPlayerOption[] {
  const byId = new Map<string, FantasyPlayerOption>();
  const byName = new Map<string, FantasyPlayerOption>();
  const byIdentity = new Map<string, FantasyPlayerOption>();

  function playerKey(teamId: string, name: string) {
    return `${teamId}:${comparablePlayerName(name)}`;
  }

  function addOrMerge(option: FantasyPlayerOption) {
    const key = playerKey(option.team.id, option.name);
    const identityKey = playerIdentityKey(option.team.id, option.name);
    const existing = byName.get(key) ?? byIdentity.get(identityKey);

    if (existing) {
      const aliasIds = Array.from(
        new Set([...(existing.aliasIds ?? []), ...(option.aliasIds ?? []), option.id].filter((id) => id !== existing.id))
      );
      const merged = {
        ...existing,
        id: existing.id,
        aliasIds,
        position: existing.position || option.position,
        fantasyPosition: existing.fantasyPosition || option.fantasyPosition,
        photoUrl: existing.photoUrl || option.photoUrl
      };
      byName.set(key, merged);
      byName.set(playerKey(existing.team.id, existing.name), merged);
      byIdentity.set(identityKey, merged);
      byIdentity.set(playerIdentityKey(existing.team.id, existing.name), merged);
      byId.set(existing.id, merged);
      return;
    }

    const normalized = { ...option, aliasIds: option.aliasIds ?? [] };
    byName.set(key, normalized);
    byIdentity.set(identityKey, normalized);
    byId.set(normalized.id, normalized);
  }

  for (const row of playerCatalog) {
    const team = getTeam(row.teamId);
    if (!team) {
      continue;
    }

    addOrMerge({
      id: row.id,
      name: row.name,
      team,
      position: row.position,
      fantasyPosition: normalizeFantasyPosition(row.position),
      photoUrl: row.photoUrl ?? undefined
    });
  }

  for (const { player, team } of getAllPlayerProfiles()) {
    addOrMerge({
      id: player.id,
      aliasIds: CURATED_PROVIDER_ALIASES[player.id],
      name: player.name,
      team,
      position: player.position,
      fantasyPosition: normalizeFantasyPosition(player.position),
      photoUrl: player.photoUrl
    });
  }

  return sortFantasyOptions([...byId.values()]);
}

export function fantasyOptionMap(playerCatalog: PlayerCatalogItem[] = []) {
  const map = new Map<string, FantasyPlayerOption>();
  const lookup = buildFantasyPlayerLookup(playerCatalog);
  for (const [id, option] of lookup.byId) {
    map.set(id, option);
  }
  return map;
}

function buildFantasyPlayerLookup(playerCatalog: PlayerCatalogItem[] = []): FantasyPlayerLookup {
  if (playerCatalog.length === 0 && emptyLookupCache) {
    return emptyLookupCache;
  }

  const cached = lookupCache.get(playerCatalog);
  if (cached) {
    return cached;
  }

  const options = fantasyPlayerOptions(playerCatalog);
  const nameKeyCounts = new Map<string, number>();
  const providerIdKeyCounts = new Map<string, number>();

  for (const option of options) {
    const ids = [option.id, ...(option.aliasIds ?? [])];
    const nameValues = [option.name, ...ids.map((id) => playerIdSuffix(option.team.id, id)).filter(Boolean)];
    const optionNameKeys = new Set<string>();

    for (const nameValue of nameValues) {
      for (const key of playerNameLookupKeys(nameValue)) {
        optionNameKeys.add(teamNameKey(option.team.id, key));
      }
    }

    for (const scoped of optionNameKeys) {
      nameKeyCounts.set(scoped, (nameKeyCounts.get(scoped) ?? 0) + 1);
    }

    for (const key of optionProviderIdLookupKeys(option)) {
      providerIdKeyCounts.set(key, (providerIdKeyCounts.get(key) ?? 0) + 1);
    }
  }

  const byId = new Map<string, FantasyPlayerOption>();
  const byName = new Map<string, FantasyPlayerOption>();
  const idsByOptionId = new Map<string, string[]>();

  for (const option of options) {
    const generatedIds = new Set([option.id, ...(option.aliasIds ?? [])]);
    const ids = [option.id, ...(option.aliasIds ?? [])];
    const nameValues = [option.name, ...ids.map((id) => playerIdSuffix(option.team.id, id)).filter(Boolean)];

    for (const nameValue of nameValues) {
      for (const key of playerNameLookupKeys(nameValue)) {
        const scoped = teamNameKey(option.team.id, key);
        if ((nameKeyCounts.get(scoped) ?? 0) !== 1) {
          continue;
        }
        byName.set(scoped, option);
        generatedIds.add(`${option.team.id}-${key}`);
      }
    }

    for (const key of optionProviderIdLookupKeys(option)) {
      if ((providerIdKeyCounts.get(key) ?? 0) === 1) {
        generatedIds.add(key);
      }
    }

    for (const id of generatedIds) {
      byId.set(id, option);
    }
    idsByOptionId.set(option.id, [...generatedIds]);
  }

  const lookup = {
    options,
    byId,
    byName,
    idsByOptionId
  };

  if (playerCatalog.length === 0) {
    emptyLookupCache = lookup;
  } else {
    lookupCache.set(playerCatalog, lookup);
  }

  return lookup;
}

function optionNameValues(option: FantasyPlayerOption) {
  const ids = [option.id, ...(option.aliasIds ?? [])];
  return [option.name, ...ids.map((id) => playerIdSuffix(option.team.id, id)).filter(Boolean)];
}

function resolveUniqueOptionByName(nameValues: string[], lookup: FantasyPlayerLookup) {
  function findUnique(keysFor: (value: string) => string[]) {
    const targetKeys = new Set(nameValues.flatMap(keysFor));
    if (targetKeys.size === 0) {
      return null;
    }

    const matches = new Map<string, FantasyPlayerOption>();
    for (const option of lookup.options) {
      const optionKeys = new Set(optionNameValues(option).flatMap(keysFor));
      if ([...targetKeys].some((key) => optionKeys.has(key))) {
        matches.set(option.id, option);
      }
    }

    return matches.size === 1 ? [...matches.values()][0] : null;
  }

  return findUnique(playerFullNameKeys) ?? findUnique(playerLooseNameKeys);
}

export function resolveFantasyPlayerOption(
  input: { playerId?: string | null; playerName?: string | null; teamId?: string | null },
  playerCatalog: PlayerCatalogItem[] = []
) {
  const lookup = buildFantasyPlayerLookup(playerCatalog);

  if (input.playerId) {
    for (const id of directPlayerIdLookupKeys(input.playerId)) {
      const byId = lookup.byId.get(id);
      if (byId) {
        return byId;
      }
    }
  }

  const teamIds = new Set<string>();
  const normalizedInputTeamId = normalizeTeamId(input.teamId);
  if (normalizedInputTeamId) {
    teamIds.add(normalizedInputTeamId);
  }
  if (input.playerId) {
    for (const option of lookup.options) {
      if (input.playerId.startsWith(`${option.team.id}-`)) {
        teamIds.add(option.team.id);
      }
    }
  }

  const nameValues = [
    input.playerName ?? "",
    input.playerId ?? "",
    ...[...teamIds].map((teamId) => (input.playerId ? playerIdSuffix(teamId, input.playerId) : "")).filter(Boolean)
  ].filter(Boolean);

  for (const teamId of teamIds) {
    for (const nameValue of nameValues) {
      for (const key of playerNameLookupKeys(nameValue)) {
        const option = lookup.byName.get(teamNameKey(teamId, key));
        if (option) {
          return option;
        }
      }
    }
  }

  return resolveUniqueOptionByName(nameValues, lookup);
}

export function fantasyScoreIdsForPlayer(playerId: string, playerCatalog: PlayerCatalogItem[] = []) {
  const lookup = buildFantasyPlayerLookup(playerCatalog);
  const option = lookup.byId.get(playerId) ?? resolveFantasyPlayerOption({ playerId }, playerCatalog);
  return Array.from(
    new Set([playerId, ...(option ? (lookup.idsByOptionId.get(option.id) ?? [option.id]) : [])].filter(Boolean))
  );
}

export function fantasyCanonicalPlayerId(playerId: string, playerCatalog: PlayerCatalogItem[] = []) {
  return resolveFantasyPlayerOption({ playerId }, playerCatalog)?.id ?? playerId;
}

function addFantasyTotal(map: Map<string, FantasyPlayerTotal>, playerId: string, score: FantasyPlayerMatchScore) {
  const total = map.get(playerId) ?? { points: 0, goals: 0, assists: 0, cleanSheets: 0 };
  total.points += score.points;
  total.goals += score.goals;
  total.assists += score.assists;
  total.cleanSheets += score.cleanSheet ? 1 : 0;
  map.set(playerId, total);
}

function fantasyTotalsByPlayerId(
  scores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = EMPTY_PLAYER_CATALOG
) {
  let catalogCache = totalsCache.get(scores);
  if (!catalogCache) {
    catalogCache = new WeakMap<PlayerCatalogItem[], Map<string, FantasyPlayerTotal>>();
    totalsCache.set(scores, catalogCache);
  }

  const cached = catalogCache.get(playerCatalog);
  if (cached) {
    return cached;
  }

  const lookup = buildFantasyPlayerLookup(playerCatalog);
  const totals = new Map<string, FantasyPlayerTotal>();

  for (const score of scores) {
    const option = lookup.byId.get(score.playerId) ?? resolveFantasyPlayerOption({ playerId: score.playerId, teamId: score.teamId }, playerCatalog);
    const ids = new Set([score.playerId, ...(option ? (lookup.idsByOptionId.get(option.id) ?? [option.id]) : [])].filter(Boolean));
    for (const id of ids) {
      addFantasyTotal(totals, id, score);
    }
  }

  catalogCache.set(playerCatalog, totals);
  return totals;
}

export function fantasyPlayerTotals(
  playerId: string,
  scores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = EMPTY_PLAYER_CATALOG
) {
  const totals = fantasyTotalsByPlayerId(scores, playerCatalog);
  const option = resolveFantasyPlayerOption({ playerId }, playerCatalog);
  return totals.get(playerId) ?? (option ? totals.get(option.id) : undefined) ?? EMPTY_PLAYER_TOTALS;
}

export function isFantasyPlayerLocked(
  playerId: string,
  matches: Match[],
  now = new Date(),
  playerCatalog: PlayerCatalogItem[] = []
) {
  const option = fantasyOptionMap(playerCatalog).get(playerId);
  const profile = getPlayerProfile(playerId);
  const catalogPlayer = playerCatalog.find((player) => player.id === playerId);
  const teamId = option?.team.id ?? profile?.team.id ?? catalogPlayer?.teamId;
  if (!teamId) {
    return false;
  }

  const teamMatches = matches
    .filter((match) => match.homeTeamId === teamId || match.awayTeamId === teamId)
    .filter((match) => match.status !== "final")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const nextMatch = teamMatches[0];
  if (!nextMatch) {
    return true;
  }

  return now.getTime() >= new Date(nextMatch.kickoff).getTime() - 5 * 60 * 1000;
}

export function validateFantasyRoster(
  slots: FantasyRosterSlot[],
  matches: Match[],
  now = new Date(),
  playerCatalog: PlayerCatalogItem[] = [],
  roundId: string | null | undefined = slots[0]?.roundId,
  formation: string | null | undefined = "4-3-3"
) {
  void matches;
  void now;
  void playerCatalog;
  void formation;
  const squadSize = fantasyRoundRosterSize(roundId);
  const starterSize = fantasyRoundStarterSize(roundId);
  const uniqueIds = new Set(slots.map((slot) => slot.playerId));
  if (uniqueIds.size !== slots.length) {
    return "Remove duplicate players before saving.";
  }
  if (slots.length > squadSize) {
    return `Pick no more than ${squadSize} players.`;
  }
  if (slots.length > 0 && !slots.some((slot) => slot.isCaptain)) {
    return "Choose a captain before saving.";
  }
  if (slots.filter((slot) => slot.isStarter).length > starterSize) {
    return `Pick no more than ${starterSize} starters.`;
  }
  return null;
}

export function normalizeFantasyRosterSlots(slots: FantasyRosterSlot[], userKey?: UserKey, roundId?: string | null): FantasyRosterSlot[] {
  const targetRoundId = normalizeFantasyRoundId(roundId ?? slots[0]?.roundId);
  const squadSize = fantasyRoundRosterSize(targetRoundId);
  const starterSize = fantasyRoundStarterSize(targetRoundId);
  const benchCapacity = Math.max(0, squadSize - starterSize);
  const seenPlayers = new Set<string>();
  const board: Array<FantasyRosterSlot | null> = Array.from({ length: starterSize }, () => null);
  const bench: FantasyRosterSlot[] = [];

  function nextOpenStarterIndex() {
    return board.findIndex((slot) => !slot);
  }

  for (const slot of [...slots].sort((a, b) => a.slotIndex - b.slotIndex)) {
    if (seenPlayers.has(slot.playerId)) {
      continue;
    }
    seenPlayers.add(slot.playerId);

    const normalized = {
      ...slot,
      userKey: userKey ?? slot.userKey,
      roundId: targetRoundId
    };

    if (slot.isStarter) {
      const preferredIndex = slot.slotIndex >= 0 && slot.slotIndex < starterSize ? slot.slotIndex : -1;
      const targetIndex = preferredIndex >= 0 && !board[preferredIndex] ? preferredIndex : nextOpenStarterIndex();
      if (targetIndex >= 0) {
        board[targetIndex] = { ...normalized, slotIndex: targetIndex, isStarter: true };
        continue;
      }
    }

    bench.push({ ...normalized, isStarter: false });
  }

  const usedIndexes = new Set(board.map((slot, index) => (slot ? index : null)).filter((index): index is number => index !== null));
  const benchIndexOrder = [
    ...Array.from({ length: benchCapacity }, (_item, index) => starterSize + index),
    ...Array.from({ length: starterSize }, (_item, index) => index)
  ];
  const normalizedBench: FantasyRosterSlot[] = [];

  for (const slot of bench) {
    if (benchCapacity > 0) {
      const slotIndex = benchIndexOrder.find((index) => !usedIndexes.has(index));
      if (slotIndex === undefined) {
        break;
      }
      usedIndexes.add(slotIndex);
      normalizedBench.push({ ...slot, slotIndex, isStarter: false });
      continue;
    }

    const starterIndex = nextOpenStarterIndex();
    if (starterIndex < 0) {
      break;
    }
    board[starterIndex] = { ...slot, slotIndex: starterIndex, isStarter: true };
  }

  return [...board.filter((slot): slot is FantasyRosterSlot => Boolean(slot)), ...normalizedBench].slice(0, squadSize);
}

function goalPoints(position: FantasyPosition) {
  if (position === "GK" || position === "DEF") {
    return 6;
  }
  if (position === "MID") {
    return 5;
  }
  return 4;
}

type FantasyTeamResult = "win" | "draw" | "loss";

function isDefensivePosition(position: FantasyPosition) {
  return position === "GK" || position === "DEF";
}

function matchTeamContext(match: Match | undefined, teamId: string) {
  if (
    !match ||
    match.status !== "final" ||
    match.homeScore === null ||
    match.awayScore === null ||
    (teamId !== match.homeTeamId && teamId !== match.awayTeamId)
  ) {
    return {
      cleanSheet: false,
      goalsConceded: undefined,
      teamResult: undefined
    };
  }

  const goalsFor = teamId === match.homeTeamId ? match.homeScore : match.awayScore;
  const goalsConceded = teamId === match.homeTeamId ? match.awayScore : match.homeScore;
  const teamResult: FantasyTeamResult = goalsFor > goalsConceded ? "win" : goalsFor === goalsConceded ? "draw" : "loss";

  return {
    cleanSheet: goalsConceded === 0,
    goalsConceded,
    teamResult
  };
}

export function scoreFantasyPlayerMatch(input: {
  position: FantasyPosition;
  goals?: number;
  assists?: number;
  cleanSheet?: boolean;
  teamResult?: FantasyTeamResult;
  goalsConceded?: number;
  yellowCards?: number;
  redCards?: number;
  ownGoals?: number;
  penaltySaves?: number;
  penaltyMisses?: number;
}) {
  const goals = input.goals ?? 0;
  const assists = input.assists ?? 0;
  const yellowCards = input.yellowCards ?? 0;
  const redCards = input.redCards ?? 0;
  const ownGoals = input.ownGoals ?? 0;
  const penaltySaves = input.penaltySaves ?? 0;
  const penaltyMisses = input.penaltyMisses ?? 0;
  const defensivePosition = isDefensivePosition(input.position);
  const cleanSheetPoints =
    input.cleanSheet && defensivePosition
      ? 4
      : input.cleanSheet && input.position === "MID"
        ? 1
        : 0;
  const teamResultPoints = input.teamResult === "win" ? 2 : input.teamResult === "draw" ? 1 : 0;
  const oneGoalConcededPoints =
    defensivePosition && typeof input.goalsConceded === "number" && input.goalsConceded === 1 ? 1 : 0;
  const goalsConcededPoints =
    defensivePosition && typeof input.goalsConceded === "number" && input.goalsConceded >= 2
      ? -Math.floor(input.goalsConceded / 2)
      : 0;

  const breakdown = {
    goals: goals * goalPoints(input.position),
    assists: assists * 3,
    cleanSheet: cleanSheetPoints,
    teamResult: teamResultPoints,
    oneGoalConceded: oneGoalConcededPoints,
    goalsConceded: goalsConcededPoints,
    yellowCards: yellowCards * -1,
    redCards: redCards * -3,
    ownGoals: ownGoals * -2,
    penaltySaves: penaltySaves * 5,
    penaltyMisses: penaltyMisses * -2
  };

  return {
    points: Object.values(breakdown).reduce((total, value) => total + value, 0),
    breakdown
  };
}

export function buildFantasyScoresFromMatches(
  matches: Match[],
  playerStats: PlayerMatchStat[],
  playerCatalog: PlayerCatalogItem[] = []
): FantasyPlayerMatchScore[] {
  const statsByPlayer = new Map<string, PlayerMatchStat>();

  function mergeStat(existing: PlayerMatchStat | undefined, incoming: PlayerMatchStat): PlayerMatchStat {
    if (!existing) {
      return incoming;
    }

    if (!existing.updatedAt || (incoming.updatedAt && new Date(incoming.updatedAt).getTime() >= new Date(existing.updatedAt).getTime())) {
      return incoming;
    }

    return existing;
  }

  for (const stat of playerStats) {
    const option = resolveFantasyPlayerOption(
      { playerId: stat.playerId, playerName: stat.playerName, teamId: stat.teamId },
      playerCatalog
    );
    if (!option) {
      continue;
    }

    const key = `${stat.matchId}:${option.id}`;
    statsByPlayer.set(
      key,
      mergeStat(statsByPlayer.get(key), {
        ...stat,
        playerId: option.id,
        playerName: option.name,
        teamId: option.team.id
      })
    );
  }

  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const scores: FantasyPlayerMatchScore[] = [];
  const candidates = new Map<
    string,
    {
      matchId: string;
      option: FantasyPlayerOption;
    }
  >();

  for (const match of matches) {
    if (match.status !== "final" || match.homeScore === null || match.awayScore === null) {
      continue;
    }

    for (const player of playerCatalog) {
      if (player.teamId !== match.homeTeamId && player.teamId !== match.awayTeamId) {
        continue;
      }

      const option = resolveFantasyPlayerOption({ playerId: player.id, playerName: player.name, teamId: player.teamId }, playerCatalog);
      if (!option) {
        continue;
      }
      candidates.set(`${match.id}:${option.id}`, { matchId: match.id, option });
    }
  }

  for (const stat of statsByPlayer.values()) {
    const option = resolveFantasyPlayerOption(
      { playerId: stat.playerId, playerName: stat.playerName, teamId: stat.teamId },
      playerCatalog
    );
    if (!option) {
      continue;
    }

    candidates.set(`${stat.matchId}:${option.id}`, { matchId: stat.matchId, option });
  }

  for (const candidate of candidates.values()) {
    const stat = statsByPlayer.get(`${candidate.matchId}:${candidate.option.id}`);
    const match = matchesById.get(candidate.matchId);
    const context = matchTeamContext(match, candidate.option.team.id);
    const goals = stat?.goals ?? 0;
    const assists = stat?.assists ?? 0;

    if (
      !stat &&
      !context.cleanSheet &&
      !context.teamResult &&
      context.goalsConceded === undefined
    ) {
      continue;
    }

    const { points, breakdown } = scoreFantasyPlayerMatch({
      position: candidate.option.fantasyPosition,
      goals,
      assists,
      cleanSheet: context.cleanSheet,
      teamResult: context.teamResult,
      goalsConceded: context.goalsConceded
    });

    scores.push({
      matchId: candidate.matchId,
      playerId: candidate.option.id,
      teamId: candidate.option.team.id,
      points,
      goals,
      assists,
      cleanSheet: context.cleanSheet,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      penaltySaves: 0,
      penaltyMisses: 0,
      breakdown,
      status: "confirmed",
      updatedAt: new Date().toISOString()
    });
  }

  return scores;
}

export function mergeFantasyScores(
  storedScores: FantasyPlayerMatchScore[],
  derivedScores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = []
): FantasyPlayerMatchScore[] {
  function normalizeScore(score: FantasyPlayerMatchScore): FantasyPlayerMatchScore {
    const option = resolveFantasyPlayerOption({ playerId: score.playerId, teamId: score.teamId }, playerCatalog);
    const { breakdown: baseBreakdown } = scoreFantasyPlayerMatch({
      position: option?.fantasyPosition ?? normalizeFantasyPosition("Forward"),
      goals: score.goals,
      assists: score.assists,
      cleanSheet: score.cleanSheet,
      yellowCards: score.yellowCards,
      redCards: score.redCards,
      ownGoals: score.ownGoals,
      penaltySaves: score.penaltySaves,
      penaltyMisses: score.penaltyMisses
    });
    const contextBreakdown = {
      teamResult: score.breakdown?.teamResult ?? 0,
      oneGoalConceded: score.breakdown?.oneGoalConceded ?? 0,
      goalsConceded: score.breakdown?.goalsConceded ?? 0
    };
    const breakdown = {
      ...baseBreakdown,
      ...contextBreakdown
    };
    const points = Object.values(breakdown).reduce((total, value) => total + value, 0);
    const hasStatValue =
      score.goals > 0 ||
      score.assists > 0 ||
      score.cleanSheet ||
      contextBreakdown.teamResult !== 0 ||
      contextBreakdown.oneGoalConceded !== 0 ||
      contextBreakdown.goalsConceded !== 0 ||
      score.yellowCards > 0 ||
      score.redCards > 0 ||
      score.ownGoals > 0 ||
      score.penaltySaves > 0 ||
      score.penaltyMisses > 0;

    const normalizedScore = option ? { ...score, playerId: option.id, teamId: option.team.id } : score;

    return hasStatValue && normalizedScore.points !== points ? { ...normalizedScore, points, breakdown } : normalizedScore;
  }

  const keyFor = (score: FantasyPlayerMatchScore) => {
    const option = resolveFantasyPlayerOption({ playerId: score.playerId, teamId: score.teamId }, playerCatalog);
    return `${score.matchId}:${option?.id ?? score.playerId}`;
  };

  const merged = new Map<string, FantasyPlayerMatchScore>();
  for (const score of storedScores) {
    const normalized = normalizeScore(score);
    merged.set(keyFor(normalized), normalized);
  }
  for (const score of derivedScores) {
    const normalized = normalizeScore(score);
    merged.set(keyFor(normalized), normalized);
  }
  return [...merged.values()];
}

export function buildFantasyLeaderboard(
  rosters: FantasyRosterSlot[],
  scores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = EMPTY_PLAYER_CATALOG
): FantasyLeaderboardRow[] {
  const lookup = buildFantasyPlayerLookup(playerCatalog);
  const totalsByPlayer = fantasyTotalsByPlayerId(scores, playerCatalog);

  return (["tata", "lucas"] as UserKey[])
    .map((userKey) => {
      const userSlots = rosters.filter((slot) => slot.userKey === userKey);
      let points = 0;
      let captainPoints = 0;
      let bestPlayer: FantasyLeaderboardRow["bestPlayer"];

      for (const slot of userSlots) {
        const option = lookup.byId.get(slot.playerId) ?? resolveFantasyPlayerOption({ playerId: slot.playerId }, playerCatalog);
        const playerPoints = (totalsByPlayer.get(slot.playerId) ?? (option ? totalsByPlayer.get(option.id) : undefined))?.points ?? 0;
        const total = slot.isCaptain ? playerPoints * 2 : playerPoints;
        points += total;
        if (slot.isCaptain) {
          captainPoints = playerPoints;
        }

        if (option && (!bestPlayer || total > bestPlayer.points)) {
          bestPlayer = { ...option, points: total };
        }
      }

      const captainSlot = userSlots.find((slot) => slot.isCaptain);
      return {
        userKey,
        displayName: familyDisplayName[userKey],
        points,
        captainPoints,
        rosterSize: userSlots.length,
        captain: captainSlot
          ? lookup.byId.get(captainSlot.playerId) ?? resolveFantasyPlayerOption({ playerId: captainSlot.playerId }, playerCatalog) ?? undefined
          : undefined,
        bestPlayer
      };
    })
    .sort((a, b) => b.points - a.points || b.rosterSize - a.rosterSize || a.displayName.localeCompare(b.displayName));
}

export function buildFantasyRoundResults(
  rosters: FantasyRosterSlot[],
  scores: FantasyPlayerMatchScore[],
  matches: Match[],
  playerCatalog: PlayerCatalogItem[] = EMPTY_PLAYER_CATALOG,
  now = new Date()
): FantasyRoundResult[] {
  return fantasyRoundStates(matches, now).map((round) => {
    const roundRosters = rostersForFantasyRound(round.id, rosters);
    const roundScores = scoresForFantasyRound(round.id, scores, matches);
    const leaderboard = buildFantasyLeaderboard(roundRosters, roundScores, playerCatalog);
    const top = leaderboard[0];
    const second = leaderboard[1];
    const tied = Boolean(top && second && top.points === second.points);
    const winner = round.status === "complete" && top && !tied ? top : undefined;

    return {
      ...round,
      leaderboard,
      winner,
      tied
    };
  });
}

export function buildFantasyOverallLeaderboard(roundResults: FantasyRoundResult[], activeRoundId?: string): FantasyOverallRow[] {
  const activeId = normalizeFantasyRoundId(activeRoundId);
  const wins = new Map<UserKey, number>([
    ["tata", 0],
    ["lucas", 0]
  ]);

  for (const round of roundResults) {
    if (round.winner) {
      wins.set(round.winner.userKey, (wins.get(round.winner.userKey) ?? 0) + 1);
    }
  }

  const activeRound = roundResults.find((round) => round.id === activeId);

  return (["tata", "lucas"] as UserKey[])
    .map((userKey) => ({
      userKey,
      displayName: familyDisplayName[userKey],
      roundWins: wins.get(userKey) ?? 0,
      currentRoundPoints: activeRound?.leaderboard.find((row) => row.userKey === userKey)?.points ?? 0
    }))
    .sort((a, b) => b.roundWins - a.roundWins || b.currentRoundPoints - a.currentRoundPoints || a.displayName.localeCompare(b.displayName));
}

export function playerTeam(playerId: string) {
  return getPlayerProfile(playerId)?.team ?? getTeam(playerId.split("-").slice(0, -1).join("-"));
}
