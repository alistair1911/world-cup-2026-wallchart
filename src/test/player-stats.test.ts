import { describe, expect, it } from "vitest";
import { buildPlayerStatLeaders } from "@/lib/player-stats";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import type { PlayerMatchStat } from "@/lib/types";

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
    expect(leaders.topAssists[0]).toMatchObject({ playerName: "Lamine Yamal", assists: 2 });
    expect(leaders.topInvolvements[0]).toMatchObject({ playerName: "Lamine Yamal", involvements: 3 });
  });
});
