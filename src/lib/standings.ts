import { GROUPS, TEAMS, getTeam } from "./tournament-data";
import type { GroupLetter, KnockoutSeed, Match, StandingRow, Team } from "./types";

type ThirdPlaceSlot = "1A" | "1B" | "1D" | "1E" | "1G" | "1I" | "1K" | "1L";

const THIRD_PLACE_SLOT_BY_POOL: Record<string, ThirdPlaceSlot> = {
  "A/B/C/D/F": "1E",
  "C/D/F/G/H": "1I",
  "C/E/F/H/I": "1A",
  "E/H/I/J/K": "1L",
  "B/E/F/I/J": "1D",
  "A/E/H/I/J": "1G",
  "E/F/G/I/J": "1B",
  "D/E/I/J/L": "1K"
};

const THIRD_PLACE_ASSIGNMENTS: Record<string, Record<ThirdPlaceSlot, GroupLetter>> = {
  BDEFIJKL: {
    "1A": "E",
    "1B": "J",
    "1D": "B",
    "1E": "D",
    "1G": "I",
    "1I": "F",
    "1K": "L",
    "1L": "K"
  },
  BDEFGIKL: {
    "1A": "E",
    "1B": "G",
    "1D": "B",
    "1E": "D",
    "1G": "I",
    "1I": "F",
    "1K": "L",
    "1L": "K"
  }
};

function emptyRow(team: Team): StandingRow {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  };
}

export function buildStandings(matches: Match[]) {
  const byGroup = Object.fromEntries(
    GROUPS.map((group) => [group, TEAMS.filter((team) => team.group === group).map(emptyRow)])
  ) as Record<GroupLetter, StandingRow[]>;

  for (const match of matches) {
    if (match.phase !== "group" || match.status !== "final" || match.homeScore === null || match.awayScore === null) {
      continue;
    }

    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);
    if (!home || !away) {
      continue;
    }

    const homeRow = byGroup[home.group].find((row) => row.team.id === home.id);
    const awayRow = byGroup[away.group].find((row) => row.team.id === away.id);
    if (!homeRow || !awayRow) {
      continue;
    }

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += match.homeScore;
    homeRow.goalsAgainst += match.awayScore;
    awayRow.goalsFor += match.awayScore;
    awayRow.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeRow.wins += 1;
      homeRow.points += 3;
      awayRow.losses += 1;
    } else if (match.homeScore < match.awayScore) {
      awayRow.wins += 1;
      awayRow.points += 3;
      homeRow.losses += 1;
    } else {
      homeRow.draws += 1;
      awayRow.draws += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }

    homeRow.goalDifference = homeRow.goalsFor - homeRow.goalsAgainst;
    awayRow.goalDifference = awayRow.goalsFor - awayRow.goalsAgainst;
  }

  for (const group of GROUPS) {
    byGroup[group] = [...byGroup[group]].sort(compareRows);
  }

  return byGroup;
}

export function compareRows(a: StandingRow, b: StandingRow) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.team.name.localeCompare(b.team.name)
  );
}

export function getThirdPlaceRows(standings: Record<GroupLetter, StandingRow[]>) {
  return GROUPS.map((group) => standings[group][2]).sort(compareRows);
}

function thirdPlaceCombinationKey(standings: Record<GroupLetter, StandingRow[]>) {
  return getThirdPlaceRows(standings)
    .slice(0, 8)
    .map((row) => row.team.group)
    .sort()
    .join("");
}

function thirdPlacePoolKey(pool: GroupLetter[]) {
  return [...pool].sort().join("/");
}

export function resolveSeed(seed: KnockoutSeed | undefined, standings: Record<GroupLetter, StandingRow[]>) {
  if (!seed) {
    return null;
  }

  if (seed.group && seed.place) {
    return standings[seed.group][seed.place - 1]?.team ?? null;
  }

  if (seed.thirdPool) {
    const slot = THIRD_PLACE_SLOT_BY_POOL[thirdPlacePoolKey(seed.thirdPool)];
    const assignment = THIRD_PLACE_ASSIGNMENTS[thirdPlaceCombinationKey(standings)];
    const assignedGroup = slot ? assignment?.[slot] : null;

    if (!assignedGroup || !seed.thirdPool.includes(assignedGroup)) {
      return null;
    }

    return standings[assignedGroup][2]?.team ?? null;
  }

  return null;
}

export function getWinnerTeamId(match: Match) {
  if (match.status !== "final" || match.homeScore === null || match.awayScore === null) {
    return null;
  }

  if (match.homeScore > match.awayScore) {
    return match.homeTeamId ?? null;
  }

  if (match.awayScore > match.homeScore) {
    return match.awayTeamId ?? null;
  }

  return match.penaltyWinnerId ?? null;
}

const PREDICTION_LOCK_MINUTES = 5;

export function predictionLockTime(match: Match) {
  return new Date(new Date(match.kickoff).getTime() - PREDICTION_LOCK_MINUTES * 60 * 1000);
}

export function isPredictionLocked(match: Match, now = new Date()) {
  return match.status !== "scheduled" || predictionLockTime(match).getTime() <= now.getTime();
}
