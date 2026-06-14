import { getTeam } from "./tournament-data";
import type { Match, MatchStatus, Team } from "./types";

export type ScoreFeedItem = {
  matchId?: string;
  matchNumber?: number;
  providerFixtureId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  kickoff?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  penaltyWinnerTeamId?: string | null;
};

export type ScoreSyncResult = {
  updates: Match[];
  skipped: Array<{ reason: string; item: ScoreFeedItem }>;
};

const TEAM_ALIASES: Record<string, string[]> = {
  usa: ["united states", "united states of america", "usa"],
  "korea-republic": ["south korea", "korea republic", "republic of korea"],
  "bosnia-herzegovina": ["bosnia", "bosnia herzegovina", "bosnia and herzegovina"],
  turkiye: ["turkey", "turkiye"],
  czechia: ["czech republic", "czechia"],
  "cote-divoire": ["ivory coast", "cote divoire", "cote d ivoire"],
  "ir-iran": ["iran", "ir iran"],
  "cabo-verde": ["cape verde", "cabo verde"],
  "congo-dr": ["dr congo", "congo dr", "democratic republic of congo"]
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function teamMatchesName(team: Team, feedName: string) {
  const normalized = normalizeName(feedName);
  const names = [team.name, team.code, ...(TEAM_ALIASES[team.id] ?? [])].map(normalizeName);
  return names.includes(normalized);
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeFeedStatus(status?: string | null): MatchStatus | null {
  if (!status) {
    return null;
  }

  const value = status.toLowerCase();
  if (["final", "ft", "aet", "pen", "finished", "match finished"].includes(value)) {
    return "final";
  }

  if (["live", "1h", "2h", "ht", "et", "p", "in_play", "in play"].includes(value)) {
    return "live";
  }

  if (["scheduled", "ns", "not_started", "not started", "tbd"].includes(value)) {
    return "scheduled";
  }

  return null;
}

function getPayloadItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["matches", "fixtures", "results", "response"]) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  return [];
}

function readGenericItem(item: Record<string, unknown>): ScoreFeedItem {
  const goals = item.goals && typeof item.goals === "object" ? (item.goals as Record<string, unknown>) : null;
  const score = item.score && typeof item.score === "object" ? (item.score as Record<string, unknown>) : null;
  const statusObject = item.status && typeof item.status === "object" ? (item.status as Record<string, unknown>) : null;

  return {
    matchId: typeof item.matchId === "string" ? item.matchId : typeof item.id === "string" ? item.id : undefined,
    providerFixtureId: typeof item.providerFixtureId === "string" ? item.providerFixtureId : undefined,
    matchNumber:
      toNumber(item.matchNumber) ?? toNumber(item.match_number) ?? toNumber(item.number) ?? toNumber(item.matchNo) ?? undefined,
    homeTeamName: typeof item.homeTeamName === "string" ? item.homeTeamName : undefined,
    awayTeamName: typeof item.awayTeamName === "string" ? item.awayTeamName : undefined,
    kickoff: typeof item.kickoff === "string" ? item.kickoff : typeof item.date === "string" ? item.date : undefined,
    homeScore: toNumber(item.homeScore) ?? toNumber(item.home_score) ?? toNumber(goals?.home) ?? toNumber(score?.home),
    awayScore: toNumber(item.awayScore) ?? toNumber(item.away_score) ?? toNumber(goals?.away) ?? toNumber(score?.away),
    status:
      typeof item.status === "string"
        ? item.status
        : typeof statusObject?.short === "string"
          ? statusObject.short
          : typeof statusObject?.long === "string"
            ? statusObject.long
            : null,
    penaltyWinnerTeamId: typeof item.penaltyWinnerTeamId === "string" ? item.penaltyWinnerTeamId : null
  };
}

function readApiFootballItem(item: Record<string, unknown>, matches: Match[]): ScoreFeedItem | null {
  const fixture = item.fixture && typeof item.fixture === "object" ? (item.fixture as Record<string, unknown>) : null;
  const teams = item.teams && typeof item.teams === "object" ? (item.teams as Record<string, unknown>) : null;
  const goals = item.goals && typeof item.goals === "object" ? (item.goals as Record<string, unknown>) : null;
  const score = item.score && typeof item.score === "object" ? (item.score as Record<string, unknown>) : null;
  const homeTeam = teams?.home && typeof teams.home === "object" ? (teams.home as Record<string, unknown>) : null;
  const awayTeam = teams?.away && typeof teams.away === "object" ? (teams.away as Record<string, unknown>) : null;
  const status = fixture?.status && typeof fixture.status === "object" ? (fixture.status as Record<string, unknown>) : null;

  if (!homeTeam || !awayTeam || !goals) {
    return null;
  }

  const homeName = typeof homeTeam.name === "string" ? homeTeam.name : "";
  const awayName = typeof awayTeam.name === "string" ? awayTeam.name : "";
  const kickoff = typeof fixture?.date === "string" ? fixture.date : undefined;
  const matched = findMatch(
    {
      homeTeamName: homeName,
      awayTeamName: awayName,
      kickoff
    },
    matches
  );

  const penalty = score?.penalty && typeof score.penalty === "object" ? (score.penalty as Record<string, unknown>) : null;
  const homePens = toNumber(penalty?.home);
  const awayPens = toNumber(penalty?.away);
  const penaltyWinnerTeamId =
    matched && homePens !== null && awayPens !== null && homePens !== awayPens
      ? homePens > awayPens
        ? matched.homeTeamId ?? null
        : matched.awayTeamId ?? null
      : null;

  return {
    matchId: matched?.id,
    providerFixtureId: typeof fixture?.id === "number" || typeof fixture?.id === "string" ? String(fixture.id) : undefined,
    homeTeamName: homeName,
    awayTeamName: awayName,
    kickoff,
    homeScore: toNumber(goals.home),
    awayScore: toNumber(goals.away),
    status: typeof status?.short === "string" ? status.short : null,
    penaltyWinnerTeamId
  };
}

export function normalizeScorePayload(payload: unknown, matches: Match[]) {
  return getPayloadItems(payload)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      if (record.fixture && record.teams && record.goals) {
        return readApiFootballItem(record, matches);
      }

      return readGenericItem(record);
    })
    .filter((item): item is ScoreFeedItem => Boolean(item));
}

function findMatch(item: ScoreFeedItem, matches: Match[]) {
  if (item.matchId) {
    const byId = matches.find((match) => match.id === item.matchId);
    if (byId) {
      return byId;
    }
  }

  if (item.matchNumber) {
    const byNumber = matches.find((match) => match.matchNumber === item.matchNumber);
    if (byNumber) {
      return byNumber;
    }
  }

  if (!item.homeTeamName || !item.awayTeamName) {
    return null;
  }

  const candidates = matches.filter((match) => {
    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);
    return home && away && teamMatchesName(home, item.homeTeamName!) && teamMatchesName(away, item.awayTeamName!);
  });

  if (!item.kickoff || candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  const feedTime = new Date(item.kickoff).getTime();
  return candidates
    .map((match) => ({ match, distance: Math.abs(new Date(match.kickoff).getTime() - feedTime) }))
    .sort((a, b) => a.distance - b.distance)[0]?.match ?? null;
}

export function buildScoreUpdates(matches: Match[], feedItems: ScoreFeedItem[]): ScoreSyncResult {
  const updates: Match[] = [];
  const skipped: ScoreSyncResult["skipped"] = [];
  const now = new Date().toISOString();

  for (const item of feedItems) {
    const match = findMatch(item, matches);
    if (!match) {
      skipped.push({ reason: "No matching wallchart match", item });
      continue;
    }

    if (match.updatedBy) {
      skipped.push({ reason: "Protected manual result", item });
      continue;
    }

    const incomingStatus = normalizeFeedStatus(item.status) ?? match.status;
    if (match.status === "final" && incomingStatus !== "final") {
      skipped.push({ reason: "Ignored non-final update for final match", item });
      continue;
    }

    const homeScore = typeof item.homeScore === "number" ? item.homeScore : match.homeScore;
    const awayScore = typeof item.awayScore === "number" ? item.awayScore : match.awayScore;
    const next: Match = {
      ...match,
      homeScore,
      awayScore,
      status: incomingStatus,
      penaltyWinnerId: item.penaltyWinnerTeamId ?? match.penaltyWinnerId ?? null,
      updatedBy: null,
      updatedAt: now
    };

    const changed =
      next.homeScore !== match.homeScore ||
      next.awayScore !== match.awayScore ||
      next.status !== match.status ||
      next.penaltyWinnerId !== match.penaltyWinnerId;

    if (!changed) {
      skipped.push({ reason: "No score/status change", item });
      continue;
    }

    updates.push(next);
  }

  return { updates, skipped };
}
