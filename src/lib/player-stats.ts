import { getAllPlayerProfiles } from "./profile-data";
import type { Match, PlayerMatchStat, Team } from "./types";

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

export function buildPlayerStatLeaders(stats: PlayerMatchStat[], matches: Match[]) {
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

  for (const stat of stats) {
    if (!finalMatchIds.has(stat.matchId) || (stat.goals <= 0 && stat.assists <= 0)) {
      continue;
    }

    const profile = profileMap.get(stat.playerId);
    if (!profile) {
      continue;
    }

    const existing =
      totals.get(stat.playerId) ??
      {
        playerId: stat.playerId,
        playerName: profile.player.name,
        team: profile.team,
        photoUrl: profile.player.photoUrl,
        position: profile.player.position,
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
    topScorers: byGoals.slice(0, 10),
    topAssists: byAssists.slice(0, 10),
    topInvolvements: byInvolvements.slice(0, 10)
  };
}
