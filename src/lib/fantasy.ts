import { getAllPlayerProfiles, getPlayerProfile } from "./profile-data";
import { getTeam } from "./tournament-data";
import type {
  FantasyPlayerMatchScore,
  FantasyPosition,
  FantasyRosterSlot,
  Match,
  PlayerMatchStat,
  Team,
  UserKey
} from "./types";

export const FANTASY_ROUND_ID = "global";
export const FANTASY_SQUAD_SIZE = 15;
export const FANTASY_STARTERS = 11;

export type FantasyPlayerOption = {
  id: string;
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
  const value = position.toUpperCase();
  if (value === "GK") {
    return "GK";
  }
  if (["CB", "DF", "LB", "RB", "LWB", "RWB"].includes(value)) {
    return "DEF";
  }
  if (["DM", "CM", "AM", "MF"].includes(value)) {
    return "MID";
  }
  return "FWD";
}

export function fantasyPlayerOptions(): FantasyPlayerOption[] {
  return getAllPlayerProfiles()
    .map(({ player, team }) => ({
      id: player.id,
      name: player.name,
      team,
      position: player.position,
      fantasyPosition: normalizeFantasyPosition(player.position),
      photoUrl: player.photoUrl
    }))
    .sort(
      (a, b) =>
        a.team.group.localeCompare(b.team.group) ||
        a.team.name.localeCompare(b.team.name) ||
        a.fantasyPosition.localeCompare(b.fantasyPosition) ||
        a.name.localeCompare(b.name)
    );
}

export function isFantasyPlayerLocked(playerId: string, matches: Match[], now = new Date()) {
  const profile = getPlayerProfile(playerId);
  if (!profile) {
    return false;
  }

  const teamMatches = matches
    .filter((match) => match.homeTeamId === profile.team.id || match.awayTeamId === profile.team.id)
    .filter((match) => match.status !== "final")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const nextMatch = teamMatches[0];
  if (!nextMatch) {
    return true;
  }

  return now.getTime() >= new Date(nextMatch.kickoff).getTime() - 5 * 60 * 1000;
}

export function validateFantasyRoster(slots: FantasyRosterSlot[], matches: Match[], now = new Date()) {
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
  if (slots.some((slot) => isFantasyPlayerLocked(slot.playerId, matches, now))) {
    return "One or more selected players are locked because their next match is close to kickoff.";
  }
  return null;
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

export function buildFantasyScoresFromMatches(matches: Match[], playerStats: PlayerMatchStat[]): FantasyPlayerMatchScore[] {
  const statsByKey = new Map<string, PlayerMatchStat>();
  for (const stat of playerStats) {
    statsByKey.set(`${stat.matchId}:${stat.playerId}`, stat);
  }

  const profiles = fantasyPlayerOptions();
  const scores: FantasyPlayerMatchScore[] = [];

  for (const match of matches.filter((item) => item.status === "final" && item.homeScore !== null && item.awayScore !== null)) {
    for (const option of profiles) {
      if (option.team.id !== match.homeTeamId && option.team.id !== match.awayTeamId) {
        continue;
      }

      const stat = statsByKey.get(`${match.id}:${option.id}`);
      const conceded =
        option.team.id === match.homeTeamId ? match.awayScore ?? null : option.team.id === match.awayTeamId ? match.homeScore ?? null : null;
      const cleanSheet = conceded === 0;
      const { points, breakdown } = scoreFantasyPlayerMatch({
        position: option.fantasyPosition,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        cleanSheet
      });

      if (points === 0 && !stat) {
        continue;
      }

      scores.push({
        matchId: match.id,
        playerId: option.id,
        teamId: option.team.id,
        points,
        goals: stat?.goals ?? 0,
        assists: stat?.assists ?? 0,
        cleanSheet,
        yellowCards: 0,
        redCards: 0,
        ownGoals: 0,
        penaltySaves: 0,
        penaltyMisses: 0,
        breakdown,
        status: stat?.assists ? "confirmed" : cleanSheet ? "needs_review" : "confirmed",
        updatedAt: new Date().toISOString()
      });
    }
  }

  return scores;
}

export function buildFantasyLeaderboard(rosters: FantasyRosterSlot[], scores: FantasyPlayerMatchScore[]): FantasyLeaderboardRow[] {
  const options = new Map(fantasyPlayerOptions().map((option) => [option.id, option]));
  const scoresByPlayer = new Map<string, number>();
  for (const score of scores) {
    scoresByPlayer.set(score.playerId, (scoresByPlayer.get(score.playerId) ?? 0) + score.points);
  }

  return (["tata", "lucas"] as UserKey[])
    .map((userKey) => {
      const userSlots = rosters.filter((slot) => slot.userKey === userKey);
      let points = 0;
      let captainPoints = 0;
      let bestPlayer: FantasyLeaderboardRow["bestPlayer"];

      for (const slot of userSlots) {
        const playerPoints = scoresByPlayer.get(slot.playerId) ?? 0;
        const total = slot.isCaptain ? playerPoints * 2 : playerPoints;
        points += total;
        if (slot.isCaptain) {
          captainPoints = playerPoints;
        }

        const option = options.get(slot.playerId);
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
