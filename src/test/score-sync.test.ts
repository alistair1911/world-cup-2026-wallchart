import { describe, expect, it } from "vitest";
import { buildScoreUpdates, normalizeScorePayload, resolveKnockoutSeedsForSync } from "@/lib/score-sync";
import { INITIAL_MATCHES } from "@/lib/tournament-data";
import type { Match } from "@/lib/types";

function finalScore(match: Match, homeScore: number, awayScore: number) {
  return {
    ...match,
    homeScore,
    awayScore,
    status: "final" as const
  };
}

function groupStandingsForSouthAfricaVsCanada() {
  const scores = new Map<string, [number, number]>([
    ["M1", [2, 0]],
    ["M2", [1, 0]],
    ["M25", [0, 1]],
    ["M28", [2, 0]],
    ["M53", [0, 2]],
    ["M54", [1, 0]],
    ["M3", [1, 0]],
    ["M8", [0, 1]],
    ["M26", [2, 0]],
    ["M27", [1, 0]],
    ["M51", [1, 0]],
    ["M52", [0, 1]]
  ]);

  return INITIAL_MATCHES.map((match) => {
    const score = scores.get(match.id);
    return score ? finalScore(match, score[0], score[1]) : match;
  });
}

describe("score sync", () => {
  it("updates a match from a normalized feed item by match number", () => {
    const result = buildScoreUpdates(INITIAL_MATCHES, [
      {
        matchNumber: 3,
        homeScore: 1,
        awayScore: 0,
        status: "live"
      }
    ]);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      id: "M3",
      homeScore: 1,
      awayScore: 0,
      status: "live"
    });
  });

  it("does not downgrade a final match from a stale live feed", () => {
    const finalMatches = INITIAL_MATCHES.map((match) =>
      match.id === "M3" ? { ...match, homeScore: 2, awayScore: 1, status: "final" as const } : match
    );
    const result = buildScoreUpdates(finalMatches, [
      {
        matchId: "M3",
        homeScore: 1,
        awayScore: 1,
        status: "live"
      }
    ]);

    expect(result.updates).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("Ignored non-final update for final match");
  });

  it("does not overwrite a manually entered result", () => {
    const manualMatches = INITIAL_MATCHES.map((match) =>
      match.id === "M3"
        ? {
            ...match,
            homeScore: 2,
            awayScore: 1,
            status: "final" as const,
            updatedBy: "tata" as const
          }
        : match
    );
    const result = buildScoreUpdates(manualMatches, [
      {
        matchId: "M3",
        homeScore: 0,
        awayScore: 3,
        status: "FT"
      }
    ]);

    expect(result.updates).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("Protected manual result");
  });

  it("ignores scheduled provider placeholder scores", () => {
    const result = buildScoreUpdates(INITIAL_MATCHES, [
      {
        matchNumber: 25,
        homeScore: 0,
        awayScore: 0,
        status: "scheduled"
      }
    ]);

    expect(result.updates).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe("Ignored scheduled provider placeholder");
  });

  it("normalizes an API-Football style fixture payload by teams and kickoff", () => {
    const items = normalizeScorePayload(
      {
        response: [
          {
            fixture: {
              date: "2026-06-12T19:00:00+00:00",
              status: { short: "FT" }
            },
            teams: {
              home: { name: "Canada" },
              away: { name: "Bosnia and Herzegovina" }
            },
            goals: {
              home: 2,
              away: 1
            }
          }
        ]
      },
      INITIAL_MATCHES
    );

    expect(items[0]).toMatchObject({
      matchId: "M3",
      homeScore: 2,
      awayScore: 1,
      status: "FT"
    });
  });

  it("resolves knockout seed teams before matching score feed items", () => {
    const resolvedMatches = resolveKnockoutSeedsForSync(groupStandingsForSouthAfricaVsCanada());
    const match73 = resolvedMatches.find((match) => match.id === "M73");

    expect(match73).toMatchObject({
      homeTeamId: "south-africa",
      awayTeamId: "canada"
    });

    const result = buildScoreUpdates(resolvedMatches, [
      {
        homeTeamName: "South Africa",
        awayTeamName: "Canada",
        homeScore: 0,
        awayScore: 1,
        status: "FT"
      }
    ]);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toMatchObject({
      id: "M73",
      homeScore: 0,
      awayScore: 1,
      status: "final"
    });
  });
});
