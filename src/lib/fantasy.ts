import { getAllPlayerProfiles, getPlayerProfile } from "./profile-data";
import { getTeam } from "./tournament-data";
import type {
  FantasyPlayerMatchScore,
  FantasyPosition,
  FantasyRosterSlot,
  Match,
  PlayerCatalogItem,
  PlayerMatchStat,
  Team,
  UserKey
} from "./types";

export const FANTASY_ROUND_ID = "global";
export const FANTASY_SQUAD_SIZE = 15;
export const FANTASY_STARTERS = 11;
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

const familyDisplayName: Record<UserKey, string> = {
  tata: "Tata",
  lucas: "Lucas"
};

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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function fantasyPlayerOptions(playerCatalog: PlayerCatalogItem[] = []): FantasyPlayerOption[] {
  const byId = new Map<string, FantasyPlayerOption>();
  const byName = new Map<string, FantasyPlayerOption>();

  function playerKey(teamId: string, name: string) {
    return `${teamId}:${comparablePlayerName(name)}`;
  }

  function addOrMerge(option: FantasyPlayerOption) {
    const key = playerKey(option.team.id, option.name);
    const existing = byName.get(key);

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
      byId.set(existing.id, merged);
      return;
    }

    const normalized = { ...option, aliasIds: option.aliasIds ?? [] };
    byName.set(key, normalized);
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
  for (const option of fantasyPlayerOptions(playerCatalog)) {
    map.set(option.id, option);
    for (const aliasId of option.aliasIds ?? []) {
      map.set(aliasId, option);
    }
  }
  return map;
}

export function fantasyScoreIdsForPlayer(playerId: string, playerCatalog: PlayerCatalogItem[] = []) {
  const option = fantasyOptionMap(playerCatalog).get(playerId);
  return Array.from(new Set([playerId, option?.id, ...(option?.aliasIds ?? [])].filter((id): id is string => Boolean(id))));
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
  playerCatalog: PlayerCatalogItem[] = []
) {
  const uniqueIds = new Set(slots.map((slot) => slot.playerId));
  if (uniqueIds.size !== slots.length) {
    return "Remove duplicate players before saving.";
  }
  if (slots.length > FANTASY_SQUAD_SIZE) {
    return `Pick no more than ${FANTASY_SQUAD_SIZE} players.`;
  }
  if (slots.length > 0 && !slots.some((slot) => slot.isCaptain)) {
    return "Choose a captain before saving.";
  }
  if (slots.filter((slot) => slot.isStarter).length > FANTASY_STARTERS) {
    return `Pick no more than ${FANTASY_STARTERS} starters.`;
  }
  if (slots.some((slot) => isFantasyPlayerLocked(slot.playerId, matches, now, playerCatalog))) {
    return "One or more selected players are locked because their next match is close to kickoff.";
  }
  return null;
}

export function normalizeFantasyRosterSlots(slots: FantasyRosterSlot[], userKey?: UserKey): FantasyRosterSlot[] {
  const seenPlayers = new Set<string>();
  const board: Array<FantasyRosterSlot | null> = Array.from({ length: FANTASY_STARTERS }, () => null);
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
      roundId: slot.roundId || FANTASY_ROUND_ID
    };

    if (slot.isStarter) {
      const preferredIndex = slot.slotIndex >= 0 && slot.slotIndex < FANTASY_STARTERS ? slot.slotIndex : -1;
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
    ...Array.from({ length: FANTASY_SQUAD_SIZE - FANTASY_STARTERS }, (_item, index) => FANTASY_STARTERS + index),
    ...Array.from({ length: FANTASY_STARTERS }, (_item, index) => index)
  ];
  const normalizedBench: FantasyRosterSlot[] = [];

  for (const slot of bench) {
    const slotIndex = benchIndexOrder.find((index) => !usedIndexes.has(index));
    if (slotIndex === undefined) {
      break;
    }
    usedIndexes.add(slotIndex);
    normalizedBench.push({ ...slot, slotIndex, isStarter: false });
  }

  return [...board.filter((slot): slot is FantasyRosterSlot => Boolean(slot)), ...normalizedBench].slice(0, FANTASY_SQUAD_SIZE);
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
  const statsById = new Map<string, PlayerMatchStat>();
  const statsByName = new Map<string, PlayerMatchStat[]>();

  function mergeStat(existing: PlayerMatchStat | undefined, incoming: PlayerMatchStat): PlayerMatchStat {
    if (!existing) {
      return incoming;
    }

    return {
      ...existing,
      goals: Math.max(existing.goals, incoming.goals),
      assists: Math.max(existing.assists, incoming.assists),
      updatedAt: incoming.updatedAt ?? existing.updatedAt
    };
  }

  for (const stat of playerStats) {
    const idKey = `${stat.matchId}:${stat.playerId}`;
    statsById.set(idKey, mergeStat(statsById.get(idKey), stat));

    const nameKey = `${stat.matchId}:${stat.teamId}:${comparablePlayerName(stat.playerName)}`;
    statsByName.set(nameKey, [...(statsByName.get(nameKey) ?? []), stat]);
  }

  const profiles = fantasyPlayerOptions(playerCatalog);
  const scores: FantasyPlayerMatchScore[] = [];

  for (const match of matches) {
    for (const option of profiles) {
      if (option.team.id !== match.homeTeamId && option.team.id !== match.awayTeamId) {
        continue;
      }

      const candidateStats = new Map<string, PlayerMatchStat>();
      for (const playerId of [option.id, ...(option.aliasIds ?? [])]) {
        const stat = statsById.get(`${match.id}:${playerId}`);
        if (stat) {
          candidateStats.set(stat.playerId, stat);
        }
      }

      for (const stat of statsByName.get(`${match.id}:${option.team.id}:${comparablePlayerName(option.name)}`) ?? []) {
        candidateStats.set(stat.playerId, stat);
      }

      const stat = [...candidateStats.values()].reduce<PlayerMatchStat | null>(
        (current, candidate) => (current ? mergeStat(current, candidate) : candidate),
        null
      );
      if (!stat) {
        continue;
      }

      const conceded =
        option.team.id === match.homeTeamId ? match.awayScore ?? null : option.team.id === match.awayTeamId ? match.homeScore ?? null : null;
      const cleanSheet = match.status === "final" && conceded === 0;
      const { points, breakdown } = scoreFantasyPlayerMatch({
        position: option.fantasyPosition,
        goals: stat.goals,
        assists: stat.assists,
        cleanSheet
      });

      scores.push({
        matchId: match.id,
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
  }

  return scores;
}

export function mergeFantasyScores(
  storedScores: FantasyPlayerMatchScore[],
  derivedScores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = []
): FantasyPlayerMatchScore[] {
  const options = fantasyOptionMap(playerCatalog);
  const keyFor = (score: FantasyPlayerMatchScore) => {
    const option = options.get(score.playerId);
    return `${score.matchId}:${option?.id ?? score.playerId}`;
  };

  const merged = new Map<string, FantasyPlayerMatchScore>();
  for (const score of storedScores) {
    merged.set(keyFor(score), score);
  }
  for (const score of derivedScores) {
    merged.set(keyFor(score), score);
  }
  return [...merged.values()];
}

export function buildFantasyLeaderboard(
  rosters: FantasyRosterSlot[],
  scores: FantasyPlayerMatchScore[],
  playerCatalog: PlayerCatalogItem[] = []
): FantasyLeaderboardRow[] {
  const options = fantasyOptionMap(playerCatalog);
  const scoresByPlayer = new Map<string, number>();
  for (const score of scores) {
    for (const playerId of fantasyScoreIdsForPlayer(score.playerId, playerCatalog)) {
      scoresByPlayer.set(playerId, (scoresByPlayer.get(playerId) ?? 0) + score.points);
    }
  }

  return (["tata", "lucas"] as UserKey[])
    .map((userKey) => {
      const userSlots = rosters.filter((slot) => slot.userKey === userKey);
      let points = 0;
      let captainPoints = 0;
      let bestPlayer: FantasyLeaderboardRow["bestPlayer"];

      for (const slot of userSlots) {
        const option = options.get(slot.playerId);
        const scoreId = option?.id ?? slot.playerId;
        const playerPoints = scoresByPlayer.get(slot.playerId) ?? scoresByPlayer.get(scoreId) ?? 0;
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
        captain: captainSlot ? options.get(captainSlot.playerId) : undefined,
        bestPlayer
      };
    })
    .sort((a, b) => b.points - a.points || b.rosterSize - a.rosterSize || a.displayName.localeCompare(b.displayName));
}

export function playerTeam(playerId: string) {
  return getPlayerProfile(playerId)?.team ?? getTeam(playerId.split("-").slice(0, -1).join("-"));
}
