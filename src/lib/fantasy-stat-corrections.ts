import { resolveFantasyPlayerOption } from "./fantasy";
import type { Match, PlayerCatalogItem, PlayerMatchStat } from "./types";

type KnownPlayerStatCorrection = {
  matchId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  goals: number;
  assists: number;
};

const USER_CONFIRMED_STAT_CORRECTIONS: KnownPlayerStatCorrection[] = [
  {
    matchId: "M19",
    playerId: "argentina-lionel-messi",
    playerName: "Lionel Messi",
    teamId: "argentina",
    goals: 3,
    assists: 0
  },
  {
    matchId: "M3",
    playerId: "canada-jonathan-david",
    playerName: "Jonathan David",
    teamId: "canada",
    goals: 3,
    assists: 0
  }
];

function teamScoreForMatch(match: Match, teamId: string) {
  if (match.homeTeamId === teamId) {
    return match.homeScore;
  }
  if (match.awayTeamId === teamId) {
    return match.awayScore;
  }
  return null;
}

function shouldApplyCorrection(correction: KnownPlayerStatCorrection, matches: Match[], now: Date) {
  const match = matches.find((item) => item.id === correction.matchId);
  if (!match) {
    return false;
  }

  if (new Date(match.kickoff).getTime() > now.getTime()) {
    return false;
  }

  const teamScore = teamScoreForMatch(match, correction.teamId);
  return typeof teamScore === "number" ? teamScore >= correction.goals : true;
}

function matchesCorrection(stat: PlayerMatchStat, correction: KnownPlayerStatCorrection, playerCatalog: PlayerCatalogItem[]) {
  if (stat.matchId !== correction.matchId || stat.teamId !== correction.teamId) {
    return false;
  }

  const option = resolveFantasyPlayerOption(
    { playerId: stat.playerId, playerName: stat.playerName, teamId: stat.teamId },
    playerCatalog
  );
  return (option?.id ?? stat.playerId) === correction.playerId;
}

export function missingKnownPlayerStatCorrections(
  matches: Match[],
  playerStats: PlayerMatchStat[],
  playerCatalog: PlayerCatalogItem[] = [],
  now = new Date()
) {
  return USER_CONFIRMED_STAT_CORRECTIONS.filter((correction) => {
    if (!shouldApplyCorrection(correction, matches, now)) {
      return false;
    }

    return !playerStats.some(
      (stat) =>
        matchesCorrection(stat, correction, playerCatalog) &&
        stat.goals >= correction.goals &&
        stat.assists >= correction.assists
    );
  }).map((correction) => ({
    ...correction,
    updatedBy: null,
    updatedAt: now.toISOString()
  }));
}

export function applyKnownPlayerStatCorrections(
  matches: Match[],
  playerStats: PlayerMatchStat[],
  playerCatalog: PlayerCatalogItem[] = [],
  now = new Date()
) {
  const missing = missingKnownPlayerStatCorrections(matches, playerStats, playerCatalog, now);
  return missing.length > 0 ? [...playerStats, ...missing] : playerStats;
}
