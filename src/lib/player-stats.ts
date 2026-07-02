import { getAllPlayerProfiles } from "./profile-data";
import { resolveFantasyPlayerOption } from "./fantasy";
import { providerIdKeys, usablePlayerStatName } from "./player-stat-names";
import { getTeam } from "./tournament-data";
import type { Match, PlayerCatalogItem, PlayerMatchStat, Team } from "./types";

export type PlayerStatLeader = {
  playerId: string;
  playerName: string;
  team: Team;
  photoUrl?: string;
  position: string;
  goals: number;
  assists: number;
  involvements: number;
  matches: number;
};

function teamScoreForStat(stat: PlayerMatchStat, match: Match | undefined) {
  if (!match) {
    return null;
  }
  if (stat.teamId === match.homeTeamId) {
    return match.homeScore;
  }
  if (stat.teamId === match.awayTeamId) {
    return match.awayScore;
  }
  return null;
}

function teamScopedCatalogPlayer(stat: PlayerMatchStat, playerCatalog: PlayerCatalogItem[]) {
  const statKeys = providerIdKeys(stat.playerId);
  if (statKeys.size === 0) {
    return null;
  }

  const matches = playerCatalog.filter((player) => {
    if (player.teamId !== stat.teamId) {
      return false;
    }
    const playerKeys = providerIdKeys(player.id);
    return [...statKeys].some((key) => playerKeys.has(key));
  });

  return matches.length === 1 ? matches[0] : null;
}

function canonicalizeStat(stat: PlayerMatchStat, playerCatalog: PlayerCatalogItem[]) {
  const statName = usablePlayerStatName(stat.playerName);
  const option = resolveFantasyPlayerOption({ playerId: stat.playerId, playerName: statName, teamId: stat.teamId }, playerCatalog);
  const catalogPlayer = option ? null : teamScopedCatalogPlayer(stat, playerCatalog);
  return {
    ...stat,
    playerId: option?.id ?? catalogPlayer?.id ?? stat.playerId,
    playerName: option?.name ?? catalogPlayer?.name ?? statName ?? stat.playerName,
    teamId: option?.team.id ?? catalogPlayer?.teamId ?? stat.teamId
  };
}

function dedupePlayerMatchStats(stats: PlayerMatchStat[], matches: Match[], playerCatalog: PlayerCatalogItem[]) {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const byPlayerMatch = new Map<string, PlayerMatchStat>();

  for (const stat of stats) {
    const canonical = canonicalizeStat(stat, playerCatalog);
    const match = matchesById.get(canonical.matchId);
    const teamScore = teamScoreForStat(canonical, match);
    const safeGoals = teamScore === null || teamScore === undefined ? canonical.goals : Math.min(canonical.goals, Math.max(0, teamScore));
    const safeStat = { ...canonical, goals: safeGoals };
    const key = `${safeStat.matchId}:${safeStat.playerId}`;
    const existing = byPlayerMatch.get(key);

    byPlayerMatch.set(
      key,
      existing
        ? {
            ...existing,
            goals: Math.max(existing.goals, safeStat.goals),
            assists: Math.max(existing.assists, safeStat.assists)
          }
        : safeStat
    );
  }

  return [...byPlayerMatch.values()];
}

export function buildPlayerStatLeaders(stats: PlayerMatchStat[], matches: Match[], playerCatalog: PlayerCatalogItem[] = []) {
  const finalMatchIds = new Set(matches.filter((match) => match.status === "final").map((match) => match.id));
  const profileMap = new Map(
    getAllPlayerProfiles().map(({ player, team }) => [
      player.id,
      {
        player,
        team
      }
    ])
  );

  const totals = new Map<string, PlayerStatLeader & { matchIds: Set<string> }>();

  for (const stat of dedupePlayerMatchStats(stats, matches, playerCatalog)) {
    if (!finalMatchIds.has(stat.matchId) || (stat.goals <= 0 && stat.assists <= 0)) {
      continue;
    }

    const profile = profileMap.get(stat.playerId);
    const catalogPlayer = playerCatalog.find((player) => player.id === stat.playerId);
    const team = profile?.team ?? getTeam(stat.teamId);
    if (!team) {
      continue;
    }
    const playerName = profile?.player.name ?? catalogPlayer?.name ?? usablePlayerStatName(stat.playerName);
    if (!playerName) {
      continue;
    }

    const existing =
      totals.get(stat.playerId) ??
      {
        playerId: stat.playerId,
        playerName,
        team,
        photoUrl: profile?.player.photoUrl ?? catalogPlayer?.photoUrl ?? undefined,
        position: profile?.player.position ?? catalogPlayer?.position ?? "Player",
        goals: 0,
        assists: 0,
        involvements: 0,
        matches: 0,
        matchIds: new Set<string>()
      };

    existing.goals += stat.goals;
    existing.assists += stat.assists;
    existing.involvements = existing.goals + existing.assists;
    existing.matchIds.add(stat.matchId);
    existing.matches = existing.matchIds.size;
    totals.set(stat.playerId, existing);
  }

  const rows = [...totals.values()].map(({ matchIds: _matchIds, ...row }) => row);
  const byGoals = [...rows].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.assists - a.assists ||
      b.involvements - a.involvements ||
      a.playerName.localeCompare(b.playerName)
  );
  const byAssists = [...rows].sort(
    (a, b) =>
      b.assists - a.assists ||
      b.goals - a.goals ||
      b.involvements - a.involvements ||
      a.playerName.localeCompare(b.playerName)
  );
  const byInvolvements = [...rows].sort(
    (a, b) =>
      b.involvements - a.involvements ||
      b.goals - a.goals ||
      b.assists - a.assists ||
      a.playerName.localeCompare(b.playerName)
  );

  return {
    topScorers: byGoals.filter((row) => row.goals > 0).slice(0, 10),
    topAssists: byAssists.filter((row) => row.assists > 0).slice(0, 10),
    topInvolvements: byInvolvements.filter((row) => row.involvements > 0).slice(0, 10)
  };
}
