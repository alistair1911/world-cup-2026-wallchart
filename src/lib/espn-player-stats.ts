import { playerId } from "./profile-data";
import { teamMatchesName } from "./score-sync";
import { getTeam } from "./tournament-data";
import type { Match, PlayerMatchStat, Team } from "./types";

type EspnEventRow = {
  eventId: string | undefined;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string | undefined;
  competitors: Array<{ id: string | null; name: string }>;
  details: unknown[];
};

function readEventObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function normalizeEventPlayerName(value: string) {
  return value
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampStat(value: number) {
  return Math.max(0, Math.min(20, Math.trunc(value)));
}

function statKey(matchId: string, playerIdValue: string) {
  return `${matchId}:${playerIdValue}`;
}

function eventTeamForMatch(match: Match, feedTeamName: string) {
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (home && teamMatchesName(home, feedTeamName)) {
    return home;
  }
  if (away && teamMatchesName(away, feedTeamName)) {
    return away;
  }
  return null;
}

function addStat(
  totals: Map<string, PlayerMatchStat>,
  match: Match,
  team: Team,
  rawName: string,
  field: "goals" | "assists",
  count = 1
) {
  const playerName = normalizeEventPlayerName(rawName);
  if (!playerName) {
    return;
  }

  const id = playerId(team.id, playerName);
  const key = statKey(match.id, id);
  const existing =
    totals.get(key) ??
    ({
      matchId: match.id,
      playerId: id,
      playerName,
      teamId: team.id,
      goals: 0,
      assists: 0,
      updatedBy: null,
      updatedAt: new Date().toISOString()
    } satisfies PlayerMatchStat);

  existing[field] += clampStat(count);
  totals.set(key, existing);
}

function readEspnEventRows(payload: unknown) {
  const record = readEventObject(payload);
  return Array.isArray(record?.espnEvents) ? (record.espnEvents as EspnEventRow[]) : [];
}

function espnTeamNameForDetail(row: EspnEventRow, detail: Record<string, unknown>) {
  const team = readEventObject(detail.team);
  const teamId = typeof team?.id === "string" || typeof team?.id === "number" ? String(team.id) : null;
  return row.competitors.find((competitor) => competitor.id === teamId)?.name ?? null;
}

function espnAthleteName(value: unknown): string | null {
  const athlete = readEventObject(value);
  const nestedAthlete = readEventObject(athlete?.athlete);
  if (nestedAthlete) {
    return espnAthleteName(nestedAthlete);
  }

  return typeof athlete?.displayName === "string"
    ? athlete.displayName
    : typeof athlete?.fullName === "string"
      ? athlete.fullName
      : typeof athlete?.name === "string"
        ? athlete.name
        : null;
}

function roleText(value: unknown) {
  const record = readEventObject(value);
  if (!record) {
    return "";
  }

  const type = readEventObject(record.type);
  const rawParts = [
    record.type,
    record.role,
    record.label,
    record.text,
    record.description,
    record.displayName,
    record.name,
    type?.displayName,
    type?.name,
    type?.text,
    type?.abbreviation
  ];

  return rawParts
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

function espnParticipantAthleteName(value: unknown) {
  const participant = readEventObject(value);
  return espnAthleteName(participant?.athlete ?? value);
}

function uniqueNames(names: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const normalized = name ? normalizeEventPlayerName(name) : "";
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function collectAssistNamesFromField(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(espnAthleteName);
  }

  return [espnAthleteName(value)];
}

function espnGoalContributors(detail: Record<string, unknown>) {
  const scorerCandidates: string[] = [];
  const assistCandidates: string[] = [];
  const unclassifiedParticipants: string[] = [];

  const participants = Array.isArray(detail.participants) ? detail.participants : [];
  for (const participant of participants) {
    const name = espnParticipantAthleteName(participant);
    if (!name) {
      continue;
    }

    const role = roleText(participant);
    if (role.includes("assist")) {
      assistCandidates.push(name);
    } else if (role.includes("scorer") || role.includes("score") || role.includes("goal")) {
      scorerCandidates.push(name);
    } else {
      unclassifiedParticipants.push(name);
    }
  }

  const athletesInvolved = Array.isArray(detail.athletesInvolved)
    ? uniqueNames(detail.athletesInvolved.map(espnAthleteName))
    : [];

  const scorer = uniqueNames([
    ...scorerCandidates,
    athletesInvolved[0],
    unclassifiedParticipants[0]
  ])[0] ?? null;

  const assists = uniqueNames([
    ...assistCandidates,
    ...collectAssistNamesFromField(detail.assist),
    ...collectAssistNamesFromField(detail.assists),
    ...athletesInvolved.slice(1)
  ]).filter((name) => !scorer || name.toLowerCase() !== scorer.toLowerCase());

  return { scorer, assists };
}

function matchForEspnEventRow(row: EspnEventRow, matches: Match[]) {
  const candidates = matches.filter((match) => {
    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);
    return home && away && teamMatchesName(home, row.homeTeamName) && teamMatchesName(away, row.awayTeamName);
  });
  if (!row.kickoff || candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  const kickoffMs = new Date(row.kickoff).getTime();
  return candidates
    .map((match) => ({ match, distance: Math.abs(new Date(match.kickoff).getTime() - kickoffMs) }))
    .sort((a, b) => a.distance - b.distance)[0]?.match ?? null;
}

export function parseEspnPlayerStats(matches: Match[], payload: unknown) {
  const totals: PlayerMatchStat[] = [];

  for (const row of readEspnEventRows(payload)) {
    const match = matchForEspnEventRow(row, matches);
    if (!match) {
      continue;
    }

    const matchTotals = new Map<string, PlayerMatchStat>();
    for (const value of row.details) {
      const detail = readEventObject(value);
      if (!detail || detail.scoringPlay !== true || detail.ownGoal === true || detail.shootout === true) {
        continue;
      }

      const teamName = espnTeamNameForDetail(row, detail);
      const team = teamName ? eventTeamForMatch(match, teamName) : null;
      const { scorer, assists } = espnGoalContributors(detail);
      if (!team || !scorer) {
        continue;
      }

      addStat(matchTotals, match, team, scorer, "goals");
      for (const assist of assists) {
        addStat(matchTotals, match, team, assist, "assists");
      }
    }

    totals.push(...matchTotals.values());
  }

  return totals.map((stat) => ({
    ...stat,
    goals: clampStat(stat.goals),
    assists: clampStat(stat.assists)
  }));
}
