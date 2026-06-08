import { GROUPS, TEAMS, getTeam } from "./tournament-data";
import type { GroupLetter, KnockoutSeed, Match, StandingRow, Team } from "./types";

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

export function resolveSeed(seed: KnockoutSeed | undefined, standings: Record<GroupLetter, StandingRow[]>) {
  if (!seed) {
    return null;
  }

  if (seed.group && seed.place) {
    return standings[seed.group][seed.place - 1]?.team ?? null;
  }

  if (seed.thirdPool) {
    const thirdPlaces = getThirdPlaceRows(standings).filter((row) => seed.thirdPool?.includes(row.team.group));
    return thirdPlaces[0]?.team ?? null;
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

export function isPredictionLocked(match: Match, now = new Date()) {
  return match.status !== "scheduled" || new Date(match.kickoff).getTime() <= now.getTime();
}
