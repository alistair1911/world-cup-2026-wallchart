import { describe, expect, it } from "vitest";
import { buildScoreUpdates, normalizeScorePayload } from "@/lib/score-sync";
import { INITIAL_MATCHES } from "@/lib/tournament-data";

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
});
