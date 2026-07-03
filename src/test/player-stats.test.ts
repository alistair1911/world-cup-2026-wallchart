import { describe, expect, it } from "vitest";
import { buildPlayerStatLeaders } from "@/lib/player-stats";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import type { PlayerCatalogItem, PlayerMatchStat } from "@/lib/types";

describe("player stat leaderboards", () => {
  it("aggregates only final match goals and assists", () => {
    const finalMatch = INITIAL_MATCHES[0];
    const scheduledMatch = INITIAL_MATCHES[1];
    const matches = INITIAL_MATCHES.map((match) =>
      match.id === finalMatch.id ? { ...match, status: "final" as const } : match
    );
    const stats: PlayerMatchStat[] = [
      {
        matchId: finalMatch.id,
        playerId: "spain-lamine-yamal",
        playerName: "Lamine Yamal",
        teamId: "spain",
        goals: 1,
        assists: 2
      },
      {
        matchId: finalMatch.id,
        playerId: "spain-rodri",
        playerName: "Rodri",
        teamId: "spain",
        goals: 2,
        assists: 0
      },
      {
        matchId: finalMatch.id,
        playerId: "spain-pedri",
        playerName: "Pedri",
        teamId: "spain",
        goals: 0,
        assists: 1
      },
      {
        matchId: scheduledMatch.id,
        playerId: "spain-lamine-yamal",
        playerName: "Lamine Yamal",
        teamId: "spain",
        goals: 9,
        assists: 9
      }
    ];

    const leaders = buildPlayerStatLeaders(stats, matches);

    expect(leaders.topScorers[0]).toMatchObject({ playerName: "Rodri", goals: 2 });
    expect(leaders.topScorers[0].goalMatches).toEqual([
      expect.objectContaining({ matchId: finalMatch.id, goals: 2 })
    ]);
    expect(leaders.topScorers.every((row) => row.goals > 0)).toBe(true);
    expect(leaders.topAssists[0]).toMatchObject({ playerName: "Lamine Yamal", assists: 2 });
    expect(leaders.topAssists.every((row) => row.assists > 0)).toBe(true);
    expect(leaders.topInvolvements[0]).toMatchObject({ playerName: "Lamine Yamal", involvements: 3 });
  });

  it("dedupes alias rows for the same player and match", () => {
    const match = {
      ...INITIAL_MATCHES[0],
      id: "M3",
      homeTeamId: "canada",
      awayTeamId: "usa",
      homeScore: 3,
      awayScore: 0,
      status: "final" as const
    };
    const playerCatalog: PlayerCatalogItem[] = [
      {
        id: "canada-8489",
        teamId: "canada",
        name: "Jonathan David",
        position: "Forward",
        photoUrl: "/players/canada-jonathan-david.jpg"
      }
    ];
    const stats: PlayerMatchStat[] = [
      {
        matchId: "M3",
        playerId: "canada-8489",
        playerName: "Jonathan David",
        teamId: "canada",
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

    const leaders = buildPlayerStatLeaders(stats, [match], playerCatalog);

    expect(leaders.topScorers).toHaveLength(1);
    expect(leaders.topScorers[0]).toMatchObject({ playerName: "Jonathan David", goals: 3 });
  });

  it("uses catalog names instead of Unknown for provider-id scorer rows", () => {
    const match = {
      ...INITIAL_MATCHES[0],
      id: "M-netherlands-provider",
      homeTeamId: "netherlands",
      awayTeamId: "tunisia",
      homeScore: 2,
      awayScore: 0,
      status: "final" as const
    };
    const playerCatalog: PlayerCatalogItem[] = [
      {
        id: "netherlands-583",
        teamId: "netherlands",
        name: "Cody Gakpo",
        position: "Forward",
        photoUrl: "/players/netherlands-cody-gakpo.jpg"
      }
    ];
    const stats: PlayerMatchStat[] = [
      {
        matchId: "M-netherlands-provider",
        playerId: "58/583",
        playerName: "Unknown",
        teamId: "netherlands",
        goals: 1,
        assists: 0
      }
    ];

    const leaders = buildPlayerStatLeaders(stats, [match], playerCatalog);

    expect(leaders.topScorers[0]).toMatchObject({
      playerId: "netherlands-583",
      playerName: "Cody Gakpo",
      goals: 1
    });
  });

  it("excludes unresolved placeholder scorer rows from the leaderboard", () => {
    const match = {
      ...INITIAL_MATCHES[0],
      id: "M-japan-unresolved",
      homeTeamId: "japan",
      awayTeamId: "sweden",
      homeScore: 1,
      awayScore: 0,
      status: "final" as const
    };
    const stats: PlayerMatchStat[] = [
      {
        matchId: "M-japan-unresolved",
        playerId: "japan-999999",
        playerName: "Unknown",
        teamId: "japan",
        goals: 1,
        assists: 0
      }
    ];

    const leaders = buildPlayerStatLeaders(stats, [match], []);

    expect(leaders.topScorers).toHaveLength(0);
  });
});
