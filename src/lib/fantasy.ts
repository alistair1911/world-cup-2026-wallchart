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

const familyDisplayName: Record<UserKey, string> = {
  tata: "Tata",
  lucas: "Lucas"
};
const lookupCache = new WeakMap<PlayerCatalogItem[], FantasyPlayerLookup>();
let emptyLookupCache: FantasyPlayerLookup | null = null;
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
    const byId = lookup.byId.get(input.playerId);
    if (byId) {
      return byId;
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

export function fantasyPlayerTotals(
  playerId: string,
  scores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = []
) {
  const targetOption = resolveFantasyPlayerOption({ playerId }, playerCatalog);
  const targetId = targetOption?.id ?? playerId;
  const scoreIds = new Set(fantasyScoreIdsForPlayer(playerId, playerCatalog));
  const totals = {
    points: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0
  };

  for (const score of scores) {
    const scoreOption = resolveFantasyPlayerOption({ playerId: score.playerId, teamId: score.teamId }, playerCatalog);
    const canonicalScoreId = scoreOption?.id ?? score.playerId;
    if (canonicalScoreId !== targetId && !scoreIds.has(score.playerId)) {
      continue;
    }

    totals.points += score.points;
    totals.goals += score.goals;
    totals.assists += score.assists;
    totals.cleanSheets += score.cleanSheet ? 1 : 0;
  }

  return totals;
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
  roundId: string | null | undefined = slots[0]?.roundId
) {
  void matches;
  void now;
  void playerCatalog;
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

export function scoreFantasyPlayerMatch(input: {
  position: FantasyPosition;
  goals?: number;
  assists?: number;
  cleanSheet?: boolean;
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
  const cleanSheetPoints =
    input.cleanSheet && (input.position === "GK" || input.position === "DEF")
      ? 4
      : input.cleanSheet && input.position === "MID"
        ? 1
        : 0;

  const breakdown = {
    goals: goals * goalPoints(input.position),
    assists: assists * 3,
    cleanSheet: cleanSheetPoints,
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

  for (const stat of statsByPlayer.values()) {
    const option = resolveFantasyPlayerOption(
      { playerId: stat.playerId, playerName: stat.playerName, teamId: stat.teamId },
      playerCatalog
    );
    if (!option) {
      continue;
    }

    const match = matchesById.get(stat.matchId);
    const isMatchParticipant = match ? option.team.id === match.homeTeamId || option.team.id === match.awayTeamId : false;

    let cleanSheet = false;
    if (match && isMatchParticipant) {
      const conceded =
        option.team.id === match.homeTeamId ? match.awayScore ?? null : option.team.id === match.awayTeamId ? match.homeScore ?? null : null;
      cleanSheet = match.status === "final" && conceded === 0;
    }

    const { points, breakdown } = scoreFantasyPlayerMatch({
      position: option.fantasyPosition,
      goals: stat.goals,
      assists: stat.assists,
      cleanSheet
    });

    scores.push({
      matchId: stat.matchId,
      playerId: option.id,
      teamId: option.team.id,
      points,
      goals: stat.goals,
      assists: stat.assists,
      cleanSheet,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      penaltySaves: 0,
      penaltyMisses: 0,
      breakdown,
      status: stat.assists ? "confirmed" : cleanSheet ? "needs_review" : "confirmed",
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
    const { points, breakdown } = scoreFantasyPlayerMatch({
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
    const hasStatValue =
      score.goals > 0 ||
      score.assists > 0 ||
      score.cleanSheet ||
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
  playerCatalog: PlayerCatalogItem[] = []
): FantasyLeaderboardRow[] {
  const lookup = buildFantasyPlayerLookup(playerCatalog);

  return (["tata", "lucas"] as UserKey[])
    .map((userKey) => {
      const userSlots = rosters.filter((slot) => slot.userKey === userKey);
      let points = 0;
      let captainPoints = 0;
      let bestPlayer: FantasyLeaderboardRow["bestPlayer"];

      for (const slot of userSlots) {
        const option = lookup.byId.get(slot.playerId) ?? resolveFantasyPlayerOption({ playerId: slot.playerId }, playerCatalog);
        const playerPoints = fantasyPlayerTotals(slot.playerId, scores, playerCatalog).points;
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
  playerCatalog: PlayerCatalogItem[] = [],
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
